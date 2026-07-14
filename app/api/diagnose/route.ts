/**
 * POST /api/diagnose — Main BuildDoctor diagnostic endpoint.
 * Node.js runtime only. Never runs repository code.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DiagnoseInput, DiagnoseResponse, GithubRateLimit } from '@/lib/types';
import { GEMINI_MODEL, LIMITS } from '@/lib/config';
import { parseGitHubUrl } from '@/lib/github/url-parser';
import { fetchRepository } from '@/lib/github/client';
import { normalizeBuildLog } from '@/lib/log-normalizer';
import { detectProject } from '@/lib/detect-project';
import { runDeterministicDiagnostics } from '@/lib/diagnostics';
import { runGeminiDiagnosis, buildDeterministicReport } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro supports up to 60s

// ── Input validation ──────────────────────────────────────────────────────────

const InputSchema = DiagnoseInput.extend({
  repositoryUrl: z.string().max(LIMITS.REPO_URL_MAX_CHARS).optional(),
  buildLog: z.string().max(LIMITS.BUILD_LOG_MAX_CHARS).optional(),
}).refine(
  d => !!(d.repositoryUrl || d.buildLog),
  { message: 'At least one of repositoryUrl or buildLog must be provided', path: ['repositoryUrl'] }
);

// ── Error helpers ─────────────────────────────────────────────────────────────

function errorResponse(code: string, message: string, status: number = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startMs = Date.now();
  const controller = new AbortController();

  // Total request timeout
  const timeout = setTimeout(() => controller.abort(), LIMITS.TOTAL_REQUEST_TIMEOUT_MS);

  try {
    // 1. Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse('INVALID_INPUT', 'Request body must be valid JSON');
    }

    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse('INVALID_INPUT', firstIssue?.message ?? 'Invalid input');
    }

    const input = parsed.data;

    // 2. Check log size
    if (input.buildLog && input.buildLog.length > LIMITS.BUILD_LOG_MAX_CHARS) {
      return errorResponse('LOG_TOO_LARGE', `Build log exceeds maximum length of ${LIMITS.BUILD_LOG_MAX_CHARS} characters`);
    }

    // 3. Normalize build log
    const normalizedLog = input.buildLog ? normalizeBuildLog(input.buildLog) : null;

    // 4. Extract referenced files from log (for prioritized fetching)
    const referencedFiles = new Set<string>();
    if (normalizedLog) {
      for (const signal of normalizedLog.matchedSignals) {
        // Extract file paths from error signals
        const fileMatches = signal.excerpt.match(/['"`]([^'"`\s]+\.[a-z]{1,5})['"`]/g);
        if (fileMatches) {
          for (const m of fileMatches) {
            referencedFiles.add(m.replace(/['"`]/g, ''));
          }
        }
      }
    }

    // 5. Fetch repository if URL provided
    let fetchResult: Awaited<ReturnType<typeof fetchRepository>> | null = null;
    let githubRateLimit: GithubRateLimit | undefined;

    if (input.repositoryUrl) {
      let parsed: ReturnType<typeof parseGitHubUrl>;
      try {
        parsed = parseGitHubUrl(input.repositoryUrl);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes('private')) return errorResponse('PRIVATE_REPOSITORY_UNSUPPORTED', msg);
        return errorResponse('INVALID_GITHUB_URL', msg);
      }

      try {
        fetchResult = await fetchRepository(
          parsed.owner,
          parsed.repo,
          input.gitRef ?? parsed.ref,
          referencedFiles,
          controller.signal
        );
        githubRateLimit = fetchResult.rateLimit;
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        const msg = (err as Error).message;
        githubRateLimit = (err as { rateLimit?: GithubRateLimit }).rateLimit;

        if (code === 'PRIVATE_REPOSITORY_UNSUPPORTED') return errorResponse(code, 'Private repositories are not supported', 403);
        if (code === 'REPOSITORY_NOT_FOUND') return errorResponse(code, 'Repository not found or is not public', 404);
        if (code === 'GITHUB_RATE_LIMIT') {
          return NextResponse.json({
            error: {
              code,
              message: 'GitHub API rate limit reached. Provide a GITHUB_TOKEN or wait for the reset.',
            },
            githubRateLimit,
          }, { status: 429 });
        }
        if (code === 'GITHUB_FETCH_FAILED') return errorResponse(code, 'Failed to fetch repository data', 502);
        return errorResponse('GITHUB_FETCH_FAILED', `Repository fetch failed: ${msg}`, 502);
      }
    }

    const files = fetchResult?.files ?? [];
    const repositoryName = fetchResult?.metadata.fullName ?? input.repositoryUrl ?? 'Unknown';
    const resolvedRef = fetchResult?.resolvedRef;

    // 6. Build project snapshot
    const snapshot = files.length > 0
      ? detectProject(files, repositoryName, resolvedRef)
      : null;

    // 7. Run deterministic diagnostics
    const deterministicFindings = runDeterministicDiagnostics(normalizedLog, files, snapshot ?? {});

    // 8. Run AI diagnosis
    let report: DiagnoseResponse['report'];
    let aiUsed = false;
    let aiSynthesisState: DiagnoseResponse['aiSynthesisState'] = 'not-configured';

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const geminiResult = await runGeminiDiagnosis(
          input,
          normalizedLog,
          snapshot,
          deterministicFindings,
          files,
          controller.signal
        );
        report = geminiResult.report;
        aiUsed = geminiResult.usedAI;
        aiSynthesisState = geminiResult.state;
        if (!aiUsed) {
          console.warn('[BuildDoctor] AI synthesis fallback', {
            failureCategory: geminiResult.state,
            httpStatus: geminiResult.httpStatus,
            model: GEMINI_MODEL,
            parsingFailed: geminiResult.parsingFailed,
            evidenceValidationRemoved: geminiResult.evidenceValidationRemoved,
          });
        }
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === 'GEMINI_NOT_CONFIGURED') {
          // Should not happen since we checked, but handle gracefully
          aiSynthesisState = 'not-configured';
          report = buildDeterministicReport(deterministicFindings, aiSynthesisState);
        } else {
          // AI failed — fall back to deterministic
          aiSynthesisState = 'provider-error';
          report = buildDeterministicReport(deterministicFindings, aiSynthesisState);
        }
      }
    } else {
      report = buildDeterministicReport(deterministicFindings, 'not-configured');
    }

    // 9. Build response
    const response: DiagnoseResponse = {
      projectSnapshot: snapshot ?? undefined,
      deterministicFindings,
      report,
      filesInspected: files.map(f => f.path),
      githubRateLimit,
      aiUsed,
      aiSynthesisState,
      processingMs: Date.now() - startMs,
    };

    // 10. Validate response size
    const responseJson = JSON.stringify(response);
    if (responseJson.length > LIMITS.RESPONSE_MAX_BYTES) {
      return errorResponse('RESPONSE_TOO_LARGE', 'Diagnosis response is too large to return safely', 500);
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const name = (err as Error).name;
    if (name === 'AbortError') {
      return errorResponse('INTERNAL_ERROR', 'Request timed out', 504);
    }
    // Never expose internal error details
    console.error('[BuildDoctor] Unhandled error:', (err as Error).message);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  } finally {
    clearTimeout(timeout);
  }
}
