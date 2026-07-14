import { z } from 'zod';
import { LIMITS } from './config';

// ── Diagnostic Categories ────────────────────────────────────────────────────

export const DiagnosticCategory = z.enum([
  'PACKAGE_MANAGER_MISMATCH',
  'LOCKFILE_CONFLICT',
  'PEER_DEPENDENCY_CONFLICT',
  'MODULE_NOT_FOUND',
  'IMPORT_CASING_MISMATCH',
  'PATH_ALIAS_MISMATCH',
  'MISSING_DEPENDENCY',
  'NODE_VERSION_MISMATCH',
  'MISSING_ENVIRONMENT_VARIABLE',
  'TYPESCRIPT_ERROR',
  'ESLINT_ERROR',
  'TEST_FAILURE',
  'BUILD_SCRIPT_MISSING',
  'INVALID_PACKAGE_SCRIPT',
  'NEXT_CONFIG_ERROR',
  'NEXT_APP_ROUTER_ERROR',
  'NEXT_SERVER_CLIENT_BOUNDARY',
  'NEXT_STATIC_EXPORT_ERROR',
  'VITE_CONFIG_ERROR',
  'BUNDLER_ERROR',
  'HYDRATION_WARNING',
  'VERCEL_FUNCTION_TIMEOUT',
  'VERCEL_PAYLOAD_LIMIT',
  'VERCEL_BUILD_COMMAND_ERROR',
  'VERCEL_ROOT_DIRECTORY_ERROR',
  'NETLIFY_CONFIG_ERROR',
  'GITHUB_ACTIONS_ERROR',
  'OUT_OF_MEMORY',
  'PERMISSION_ERROR',
  'NETWORK_OR_REGISTRY_FAILURE',
  'RATE_LIMIT',
  'DEPRECATED_PACKAGE',
  'UNKNOWN',
]);
export type DiagnosticCategory = z.infer<typeof DiagnosticCategory>;

export const Severity = z.enum(['critical', 'high', 'medium', 'low']);
export type Severity = z.infer<typeof Severity>;

export const Confidence = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

// ── Log Types ────────────────────────────────────────────────────────────────

export const LogSectionKind = z.enum(['command', 'warning', 'error', 'stack', 'summary', 'unknown']);
export type LogSectionKind = z.infer<typeof LogSectionKind>;

export const LogSection = z.object({
  id: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  kind: LogSectionKind,
  text: z.string(),
});
export type LogSection = z.infer<typeof LogSection>;

export const DiagnosticSignal = z.object({
  pattern: z.string(),
  lineNumber: z.number().int().nonnegative(),
  excerpt: z.string(),
  category: DiagnosticCategory,
});
export type DiagnosticSignal = z.infer<typeof DiagnosticSignal>;

export const NormalizedLog = z.object({
  originalLineCount: z.number().int().nonnegative(),
  normalizedLineCount: z.number().int().nonnegative(),
  wasTruncated: z.boolean(),
  omittedLineCount: z.number().int().nonnegative().optional(),
  sections: z.array(LogSection),
  matchedSignals: z.array(DiagnosticSignal),
  redactedCount: z.number().int().nonnegative(),
});
export type NormalizedLog = z.infer<typeof NormalizedLog>;

// ── Evidence ─────────────────────────────────────────────────────────────────

export const EvidenceSource = z.enum(['build-log', 'repository', 'configuration', 'dependency']);
export type EvidenceSource = z.infer<typeof EvidenceSource>;

export const EvidenceItem = z.object({
  id: z.string(),
  source: EvidenceSource,
  file: z.string().optional(),
  lineStart: z.number().int().nonnegative().optional(),
  lineEnd: z.number().int().nonnegative().optional(),
  excerpt: z.string().max(2000),
  explanation: z.string().max(1000),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

// ── Repair Plan ───────────────────────────────────────────────────────────────

export const RepairStep = z.object({
  order: z.number().int().positive(),
  title: z.string().max(200),
  description: z.string().max(2000),
  risk: z.enum(['low', 'medium', 'high']),
  files: z.array(z.string()).optional(),
  commands: z.array(z.string()).optional(),
  expectedOutcome: z.string().max(500),
});
export type RepairStep = z.infer<typeof RepairStep>;

export const SuggestedPatch = z.object({
  file: z.string().max(500),
  rationale: z.string().max(1000),
  before: z.string().max(2000).optional(),
  after: z.string().max(2000),
  confidence: Confidence,
});
export type SuggestedPatch = z.infer<typeof SuggestedPatch>;

export const VerificationCommand = z.object({
  command: z.string().max(500),
  description: z.string().max(500),
  expectedOutcome: z.string().max(500),
});
export type VerificationCommand = z.infer<typeof VerificationCommand>;

export const ContributingFactor = z.object({
  title: z.string().max(200),
  description: z.string().max(1000),
  severity: Severity,
});
export type ContributingFactor = z.infer<typeof ContributingFactor>;

// ── Project Snapshot ──────────────────────────────────────────────────────────

export const ProjectSnapshot = z.object({
  repositoryName: z.string(),
  selectedRef: z.string().optional(),
  primaryLanguage: z.string().optional(),
  framework: z.string().optional(),
  packageManager: z.string().optional(),
  packageManagerVersion: z.string().optional(),
  buildCommand: z.string().optional(),
  devCommand: z.string().optional(),
  testCommand: z.string().optional(),
  lintCommand: z.string().optional(),
  nodeVersionRequirement: z.string().optional(),
  typescriptUsage: z.boolean(),
  isMonorepo: z.boolean(),
  workspacePackages: z.array(z.string()).optional(),
  deploymentConfig: z.string().optional(),
  lockfiles: z.array(z.string()),
  pathAliases: z.record(z.string(), z.array(z.string())).optional(),
  envVarsReferenced: z.array(z.string()).optional(),
  configFilesFound: z.array(z.string()),
  relevantDependencies: z.record(z.string(), z.string()).optional(),
});
export type ProjectSnapshot = z.infer<typeof ProjectSnapshot>;

// ── Deterministic Finding ─────────────────────────────────────────────────────

export const DeterministicFinding = z.object({
  id: z.string(),
  category: DiagnosticCategory,
  severity: Severity,
  confidence: Confidence,
  title: z.string().max(200),
  summary: z.string().max(1000),
  evidence: z.array(EvidenceItem),
  recommendedAction: z.string().max(1000),
});
export type DeterministicFinding = z.infer<typeof DeterministicFinding>;

// ── Diagnosis Report ──────────────────────────────────────────────────────────

export const DiagnosisStatus = z.enum(['diagnosed', 'partial', 'insufficient-evidence']);
export type DiagnosisStatus = z.infer<typeof DiagnosisStatus>;

export const DiagnosisReport = z.object({
  status: DiagnosisStatus,
  primaryDiagnosis: z.object({
    title: z.string().max(300),
    category: DiagnosticCategory,
    severity: Severity,
    confidence: Confidence,
    summary: z.string().max(2000),
    whyItFails: z.string().max(2000),
  }),
  evidence: z.array(EvidenceItem).max(LIMITS.EVIDENCE_MAX),
  contributingFactors: z.array(ContributingFactor),
  repairPlan: z.array(RepairStep),
  suggestedPatches: z.array(SuggestedPatch).max(LIMITS.PATCHES_MAX),
  verificationCommands: z.array(VerificationCommand),
  unresolvedQuestions: z.array(z.string().max(500)),
  limitations: z.array(z.string().max(500)),
  usedAI: z.boolean(),
  severityCounts: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
  }).optional(),
});
export type DiagnosisReport = z.infer<typeof DiagnosisReport>;

// ── API I/O ───────────────────────────────────────────────────────────────────

export const DiagnoseInput = z.object({
  repositoryUrl: z.string().max(LIMITS.REPO_URL_MAX_CHARS).optional(),
  gitRef: z.string().max(LIMITS.GIT_REF_MAX_CHARS).optional(),
  buildLog: z.string().max(LIMITS.BUILD_LOG_MAX_CHARS).optional(),
  projectContext: z.string().max(LIMITS.PROJECT_CONTEXT_MAX_CHARS).optional(),
  platform: z.enum(['local', 'vercel', 'netlify', 'github-actions', 'other']),
});
export type DiagnoseInput = z.infer<typeof DiagnoseInput>;

export const GithubRateLimit = z.object({
  remaining: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  resetAt: z.string().optional(),
  authenticated: z.boolean(),
});
export type GithubRateLimit = z.infer<typeof GithubRateLimit>;

export const DiagnoseResponse = z.object({
  projectSnapshot: ProjectSnapshot.optional(),
  deterministicFindings: z.array(DeterministicFinding),
  report: DiagnosisReport,
  filesInspected: z.array(z.string()),
  githubRateLimit: GithubRateLimit.optional(),
  aiUsed: z.boolean(),
  processingMs: z.number().int().nonnegative(),
});
export type DiagnoseResponse = z.infer<typeof DiagnoseResponse>;

// ── Public Error Codes ─────────────────────────────────────────────────────────

export const ErrorCode = z.enum([
  'INVALID_INPUT',
  'INVALID_GITHUB_URL',
  'PRIVATE_REPOSITORY_UNSUPPORTED',
  'REPOSITORY_NOT_FOUND',
  'GITHUB_RATE_LIMIT',
  'GITHUB_FETCH_FAILED',
  'LOG_TOO_LARGE',
  'UNSUPPORTED_FILE',
  'GEMINI_NOT_CONFIGURED',
  'AI_ANALYSIS_FAILED',
  'RESPONSE_TOO_LARGE',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export interface ApiError {
  code: ErrorCode;
  message: string;
}

// ── App UI State ───────────────────────────────────────────────────────────────

export type AppPhase =
  | 'editing'
  | 'validating'
  | 'fetching-repository'
  | 'analyzing'
  | 'report'
  | 'error';

export type ReportFilter =
  | 'all'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'log-evidence'
  | 'repository-evidence'
  | 'patches';

export type Platform = 'local' | 'vercel' | 'netlify' | 'github-actions' | 'other';
