/**
 * BuildDoctor — Centralized limits configuration
 * All input and processing limits are defined here.
 */

export const LIMITS = {
  // Input limits
  REPO_URL_MAX_CHARS: 2048,
  GIT_REF_MAX_CHARS: 200,
  BUILD_LOG_MAX_CHARS: 200_000,
  PROJECT_CONTEXT_MAX_CHARS: 20_000,
  UPLOAD_MAX_BYTES: 500 * 1024, // 500 KB

  // GitHub fetch limits
  FETCHED_CONTENT_MAX_CHARS: 600_000,
  FETCHED_FILES_MAX: 50,
  INDIVIDUAL_FILE_MAX_BYTES: 150 * 1024, // 150 KB
  MAX_TREE_ITEMS: 15_000, // Safe bound against memory exhaustion on massive repos

  // Diagnosis limits
  FINDINGS_MAX: 12,
  EVIDENCE_MAX: 30,
  PATCHES_MAX: 8,

  // GitHub API
  GITHUB_CONCURRENT_FETCHES: 5,
  GITHUB_FETCH_TIMEOUT_MS: 15_000,

  // AI
  AI_TIMEOUT_MS: 8_000,
  TOTAL_REQUEST_TIMEOUT_MS: 30_000,

  // Response
  RESPONSE_MAX_BYTES: 4 * 1024 * 1024, // 4 MB safe buffer

  // Line lengths
  LOG_LINE_MAX_CHARS: 2000,

  // Prompt limits
  LOG_EXCERPT_MAX_CHARS: 20_000,
  REPO_CONTEXT_MAX_CHARS: 30_000,
} as const;

export const ALLOWED_UPLOAD_TYPES = ['text/plain', 'text/x-log', 'application/octet-stream'];
export const ALLOWED_UPLOAD_EXTENSIONS = ['.txt', '.log'];

/** Gemini model — centralized, server-only */
export const GEMINI_MODEL = 'gemini-3.5-flash';

/** Supported deployment platforms */
export const PLATFORMS = [
  { value: 'local', label: 'Local' },
  { value: 'vercel', label: 'Vercel' },
  { value: 'netlify', label: 'Netlify' },
  { value: 'github-actions', label: 'GitHub Actions' },
  { value: 'other', label: 'Other' },
] as const;

export type Platform = (typeof PLATFORMS)[number]['value'];
