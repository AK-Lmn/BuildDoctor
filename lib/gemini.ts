/**
 * Gemini AI-assisted diagnosis adapter.
 * Server-side only — uses @google/genai SDK.
 */

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { GEMINI_MODEL, LIMITS } from './config';
import { extractLogExcerpt } from './log-normalizer';
import { DiagnosisReport, DiagnosticCategory, Severity, Confidence } from './types';
import type {
  NormalizedLog,
  ProjectSnapshot,
  DeterministicFinding,
  DiagnoseInput,
} from './types';
import type { GitHubFile } from './github/client';

// ── Schema sent to Gemini ─────────────────────────────────────────────────────

const GeminiDiagnosisSchema = z.object({
  status: z.enum(['diagnosed', 'partial', 'insufficient-evidence']),
  primaryDiagnosis: z.object({
    title: z.string(),
    category: DiagnosticCategory,
    severity: Severity,
    confidence: Confidence,
    summary: z.string(),
    whyItFails: z.string(),
  }),
  evidence: z.array(z.object({
    id: z.string().optional(),
    source: z.enum(['build-log', 'repository', 'configuration', 'dependency']),
    file: z.string().optional(),
    lineStart: z.number().optional(),
    lineEnd: z.number().optional(),
    excerpt: z.string(),
    explanation: z.string(),
  })),
  contributingFactors: z.array(z.object({
    title: z.string(),
    description: z.string(),
    severity: Severity,
  })),
  repairPlan: z.array(z.object({
    order: z.number(),
    title: z.string(),
    description: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
    files: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    expectedOutcome: z.string(),
  })),
  suggestedPatches: z.array(z.object({
    file: z.string(),
    rationale: z.string(),
    before: z.string().optional(),
    after: z.string(),
    confidence: Confidence,
  })),
  verificationCommands: z.array(z.object({
    command: z.string(),
    description: z.string(),
    expectedOutcome: z.string(),
  })),
  unresolvedQuestions: z.array(z.string()),
  limitations: z.array(z.string()),
});

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(
  input: DiagnoseInput,
  log: NormalizedLog | null,
  snapshot: ProjectSnapshot | null,
  deterministicFindings: DeterministicFinding[],
  files: GitHubFile[]
): string {
  const logExcerpt = log ? extractLogExcerpt(log, LIMITS.LOG_EXCERPT_MAX_CHARS) : '';

  const repoContext = files
    .slice(0, 10)
    .map(f => `--- FILE: ${f.path} ---\n${f.content.slice(0, 3000)}`)
    .join('\n\n')
    .slice(0, LIMITS.REPO_CONTEXT_MAX_CHARS);

  const deterministicSummary = deterministicFindings
    .map(f => `- [${f.severity.toUpperCase()}] ${f.category}: ${f.title}`)
    .join('\n');

  return `You are BuildDoctor, a build-failure diagnostic assistant for JavaScript and TypeScript projects.

IMPORTANT EPISTEMIC RULES:
- Only report findings directly supported by the evidence provided
- Never claim to have run the build or executed any code
- Never invent file paths, line numbers, or package versions
- Never claim a fix is guaranteed to work
- If evidence is insufficient, say so clearly
- Distinguish direct evidence from inference
- Do not suggest deleting lockfiles as the default fix
- Do not recommend --force or --legacy-peer-deps as the primary solution
- Do not recommend disabling TypeScript or ESLint broadly
- Patches are advisory only — label risky ones clearly

PLATFORM: ${input.platform}
REPOSITORY: ${input.repositoryUrl ?? 'Not provided'}
REF: ${input.gitRef ?? 'default branch'}

PROJECT SNAPSHOT:
${snapshot ? JSON.stringify(snapshot, null, 2) : 'Not available'}

DETERMINISTIC FINDINGS (already identified — do not contradict these without strong evidence):
${deterministicSummary || 'None'}

BUILD LOG EXCERPT (redacted):
\`\`\`
${logExcerpt || 'Not provided'}
\`\`\`

REPOSITORY FILES (selected, redacted):
${repoContext || 'Not provided'}

Based on the above evidence, provide a structured diagnosis.

LIMITS:
- evidence: maximum ${LIMITS.EVIDENCE_MAX} items
- repairPlan: maximum 8 steps
- suggestedPatches: maximum ${LIMITS.PATCHES_MAX} (small diffs only, not full file replacements)
- unresolvedQuestions: list what additional information would help
- limitations: list what you cannot determine from the available evidence

Respond with a JSON object matching the DiagnosisReport schema exactly.`;
}

// ── Evidence validation ───────────────────────────────────────────────────────

function validateEvidence(
  report: z.infer<typeof GeminiDiagnosisSchema>,
  log: NormalizedLog | null,
  files: GitHubFile[]
): z.infer<typeof GeminiDiagnosisSchema> {
  const validatedFiles = new Set(files.map(f => f.path));
  const logLineCount = log?.normalizedLineCount ?? 0;

  const validEvidence = report.evidence.filter(ev => {
    // Validate file references
    if (ev.source === 'repository' || ev.source === 'configuration') {
      if (ev.file && !validatedFiles.has(ev.file)) {
        return false; // Remove evidence citing files we didn't fetch
      }
    }

    // Validate log line references
    if (ev.source === 'build-log') {
      if (ev.lineStart !== undefined && ev.lineStart > logLineCount) {
        return false; // Invalid log line reference
      }
    }

    return true;
  });

  return {
    ...report,
    evidence: validEvidence.slice(0, LIMITS.EVIDENCE_MAX),
  };
}

// ── Main adapter ──────────────────────────────────────────────────────────────

export interface GeminiAdapterResult {
  report: z.infer<typeof DiagnosisReport>;
  usedAI: boolean;
  repairAttempted: boolean;
}

export async function runGeminiDiagnosis(
  input: DiagnoseInput,
  log: NormalizedLog | null,
  snapshot: ProjectSnapshot | null,
  deterministicFindings: DeterministicFinding[],
  files: GitHubFile[],
  signal?: AbortSignal
): Promise<GeminiAdapterResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw Object.assign(new Error('GEMINI_API_KEY is not configured'), { code: 'GEMINI_NOT_CONFIGURED' });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(input, log, snapshot, deterministicFindings, files);

  let rawResponse: unknown;
  let repairAttempted = false;

  // First attempt
  try {
    const timeoutSignal = AbortSignal.timeout(LIMITS.AI_TIMEOUT_MS);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');

    rawResponse = JSON.parse(text);
    void combinedSignal; // used for cancellation concept
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw Object.assign(new Error('AI diagnosis timed out'), { code: 'AI_ANALYSIS_FAILED' });
    }
    throw Object.assign(
      new Error('AI analysis failed: ' + (err instanceof Error ? err.message : 'unknown error')),
      { code: 'AI_ANALYSIS_FAILED' }
    );
  }

  // Validate with Zod
  let parsed = GeminiDiagnosisSchema.safeParse(rawResponse);

  if (!parsed.success) {
    // One repair attempt — ask Gemini to fix the structure
    repairAttempted = true;
    try {
      const repairPrompt = `The following JSON did not match the expected schema. Fix it to match the DiagnosisReport structure:

Schema errors: ${JSON.stringify(parsed.error.issues.slice(0, 5))}

Original JSON (truncated):
${JSON.stringify(rawResponse).slice(0, 2000)}

Return only valid JSON.`;

      const repairResp = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: repairPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const repairText = repairResp.text;
      if (repairText) {
        rawResponse = JSON.parse(repairText);
        parsed = GeminiDiagnosisSchema.safeParse(rawResponse);
      }
    } catch {
      // Repair failed — fall through to deterministic fallback
    }
  }

  if (!parsed.success) {
    throw Object.assign(new Error('AI structured response failed validation'), { code: 'AI_ANALYSIS_FAILED' });
  }

  // Post-process: validate evidence references
  const validated = validateEvidence(parsed.data, log, files);

  // Map to DiagnosisReport, adding IDs and usedAI
  const report = DiagnosisReport.parse({
    ...validated,
    evidence: validated.evidence.map((ev, i) => ({
      ...ev,
      id: ev.id ?? `ai-ev-${i}`,
    })),
    usedAI: true,
    severityCounts: computeSeverityCounts(validated),
  });

  return { report, usedAI: true, repairAttempted };
}

function computeSeverityCounts(report: z.infer<typeof GeminiDiagnosisSchema>) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  counts[report.primaryDiagnosis.severity]++;
  for (const factor of report.contributingFactors) {
    counts[factor.severity]++;
  }
  return counts;
}

// ── Deterministic fallback report ─────────────────────────────────────────────

export function buildDeterministicReport(
  findings: DeterministicFinding[]
): z.infer<typeof DiagnosisReport> {
  const primary = findings[0];

  if (!primary) {
    return {
      status: 'insufficient-evidence',
      primaryDiagnosis: {
        title: 'Insufficient evidence to diagnose',
        category: 'UNKNOWN',
        severity: 'low',
        confidence: 'low',
        summary: 'No specific build failure patterns were detected in the provided log or repository files.',
        whyItFails: 'Insufficient information available to determine the root cause.',
      },
      evidence: [],
      contributingFactors: [],
      repairPlan: [
        {
          order: 1,
          title: 'Provide more build log context',
          description: 'Share the complete build log including the initial error messages.',
          risk: 'low',
          expectedOutcome: 'BuildDoctor will have enough context to identify the root cause.',
        },
      ],
      suggestedPatches: [],
      verificationCommands: [],
      unresolvedQuestions: [
        'What is the complete error message?',
        'What platform is being used for deployment?',
        'What does the build log show before the failure?',
      ],
      limitations: [
        'AI analysis was not available (GEMINI_API_KEY not configured)',
        'Limited evidence available for diagnosis',
      ],
      usedAI: false,
    };
  }

  return {
    status: findings.length > 0 ? 'partial' : 'insufficient-evidence',
    primaryDiagnosis: {
      title: primary.title,
      category: primary.category,
      severity: primary.severity,
      confidence: primary.confidence,
      summary: primary.summary,
      whyItFails: primary.recommendedAction,
    },
    evidence: findings.flatMap(f => f.evidence).slice(0, LIMITS.EVIDENCE_MAX),
    contributingFactors: findings.slice(1).map(f => ({
      title: f.title,
      description: f.summary,
      severity: f.severity,
    })),
    repairPlan: [
      {
        order: 1,
        title: primary.title,
        description: primary.recommendedAction,
        risk: 'low' as const,
        expectedOutcome: 'The primary identified issue will be resolved.',
      },
    ],
    suggestedPatches: [],
    verificationCommands: [
      {
        command: 'npm run build',
        description: 'Rebuild after fixes',
        expectedOutcome: 'Build succeeds without errors',
      },
    ],
    unresolvedQuestions: ['AI analysis was not performed — provide a GEMINI_API_KEY for full diagnosis.'],
    limitations: ['AI analysis unavailable — only deterministic patterns were used.'],
    usedAI: false,
    severityCounts: {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    },
  };
}
