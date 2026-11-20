/**
 * GitHub API client — fetches repository metadata and selected config files.
 * Server-side only. Never exposes the GitHub token.
 */

import { LIMITS } from '../config';
import { redactFileContent } from '../redact';
import type { GithubRateLimit } from '../types';
import { isNonProjectPath } from '../project-files';

const GITHUB_API_BASE = 'https://api.github.com';

// ── Allowlisted file patterns ─────────────────────────────────────────────────

const ALLOWLISTED_FILES = new Set([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'tsconfig.json',
  'jsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'vitest.config.js',
  'vitest.config.ts',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.ts',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.npmrc',
  '.nvmrc',
  '.node-version',
  'vercel.json',
  'netlify.toml',
  'turbo.json',
  'nx.json',
  'wrangler.toml',
  'app.json',
  'vite-env.d.ts',
  'next-env.d.ts',
  '.github/workflows',
]);

const ALLOWLISTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.toml', '.yaml', '.yml',
]);

// Directories to always skip
const BLOCKED_DIRS = new Set([
  'node_modules', '.next', 'dist', 'build', 'out', 'coverage',
  '.git', '.turbo', '.vercel', 'vendor',
]);

const BLOCKED_FILES = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  '.env.staging', '.env.test', '.env.preview',
  'credentials.json', 'service-account.json',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.tar', '.gz', '.rar',
  '.mp4', '.mp3', '.wav',
  '.pdf', '.docx', '.xlsx',
  '.lockb', // bun binary lockfile
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

export interface RepoMetadata {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  size: number; // KB
  language: string | null;
}

export interface GitHubFetchResult {
  metadata: RepoMetadata;
  files: GitHubFile[];
  resolvedRef: string;
  rateLimit: GithubRateLimit;
  filesAttempted: number;
  totalFetchedChars: number;
}

export interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
  url: string;
}

// ── Auth headers ──────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'BuildDoctor/1.0',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function parseRateLimit(response: Response, authenticated: boolean): GithubRateLimit {
  return {
    remaining: parseInt(response.headers.get('x-ratelimit-remaining') ?? '60', 10),
    limit: parseInt(response.headers.get('x-ratelimit-limit') ?? '60', 10),
    resetAt: response.headers.get('x-ratelimit-reset')
      ? new Date(parseInt(response.headers.get('x-ratelimit-reset')!, 10) * 1000).toISOString()
      : undefined,
    authenticated,
  };
}

// ── File filter ───────────────────────────────────────────────────────────────

export function shouldFetchFile(item: GitHubTreeItem, referencedFiles: Set<string>): boolean {
  if (item.type !== 'blob') return false;

  const path = item.path;
  const lower = path.toLowerCase();
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';

  // Block credential files
  if (BLOCKED_FILES.has(filename) || BLOCKED_FILES.has(lower)) return false;

  // Block files in blocked dirs
  if (parts.some(p => BLOCKED_DIRS.has(p))) return false;

  // Block binary files
  if (BINARY_EXTENSIONS.has(ext)) return false;

  // Fixtures and test-only content cannot describe the primary project unless the log names it.
  const isReferenced = referencedFiles.has(path) || referencedFiles.has(filename);
  if (isNonProjectPath(path) && !isReferenced) return false;

  // Check file size
  if (item.size && item.size > LIMITS.INDIVIDUAL_FILE_MAX_BYTES) return false;

  // Allowlisted exact filenames
  if (ALLOWLISTED_FILES.has(filename) || ALLOWLISTED_FILES.has(path)) return true;

  // GitHub workflow YAML (static inspection only)
  if (path.startsWith('.github/workflows/') && (ext === '.yml' || ext === '.yaml')) return true;

  // Source files referenced by errors
  if (isReferenced) return true;

  // Top-level source dirs with allowed extensions
  const topDir = parts[0];
  if (
    (topDir === 'src' || topDir === 'app' || topDir === 'pages') &&
    parts.length <= 4 &&
    ALLOWLISTED_EXTENSIONS.has(ext)
  ) {
    // Only small source files in entry dirs
    if (!item.size || item.size < 50_000) return true;
  }

  return false;
}

export function rankCandidateFiles(items: GitHubTreeItem[], referencedFiles: Set<string>): GitHubTreeItem[] {
  // Tree entries do not include content, so workspace packages are ranked after root configuration.
  // Their allowlisted package.json entries remain ahead of ordinary source files.
  return [...items].sort((a, b) => score(b) - score(a) || a.path.localeCompare(b.path));

  function score(item: GitHubTreeItem): number {
    const filename = item.path.split('/').pop()!;
    const referenced = referencedFiles.has(item.path) || referencedFiles.has(filename);
    if (referenced) return 500;
    if (!item.path.includes('/') && ALLOWLISTED_FILES.has(filename)) return 400;
    if (!item.path.includes('/') && (item.path.startsWith('.github/') || filename.endsWith('.config.js') || filename.endsWith('.config.ts'))) return 400;
    if (filename === 'package.json' && !isNonProjectPath(item.path)) return 300;
    if ((item.path.startsWith('src/') || item.path.startsWith('app/') || item.path.startsWith('pages/')) && !isNonProjectPath(item.path)) return 200;
    return isNonProjectPath(item.path) ? 0 : 100;
  }
}

// ── Main fetch function ───────────────────────────────────────────────────────

export async function fetchRepository(
  owner: string,
  repo: string,
  ref: string | undefined,
  referencedFiles: Set<string>,
  signal?: AbortSignal
): Promise<GitHubFetchResult> {
  const authenticated = !!process.env.GITHUB_TOKEN;
  const headers = getAuthHeaders();

  // 1. Fetch repository metadata
  const metaUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  let metaResp = await fetch(metaUrl, { headers, signal });

  // If a token was provided but failed with 401 Unauthorized or 403 Forbidden (e.g. expired or revoked token),
  // automatically fall back to public unauthenticated request so the app never breaks for public repos.
  if ((metaResp.status === 401 || (metaResp.status === 403 && authenticated)) && headers['Authorization']) {
    delete headers['Authorization'];
    metaResp = await fetch(metaUrl, { headers, signal });
  }

  const rateLimit = parseRateLimit(metaResp, authenticated && !!headers['Authorization']);

  if (metaResp.status === 404) {
    throw Object.assign(new Error('Repository not found or is private'), { code: 'REPOSITORY_NOT_FOUND' });
  }
  if (metaResp.status === 403 || metaResp.status === 429) {
    throw Object.assign(new Error('GitHub rate limit reached'), { code: 'GITHUB_RATE_LIMIT', rateLimit });
  }
  if (!metaResp.ok) {
    throw Object.assign(new Error(`GitHub API error: ${metaResp.status}`), { code: 'GITHUB_FETCH_FAILED' });
  }

  const metaData = await metaResp.json() as {
    full_name: string;
    default_branch: string;
    private: boolean;
    description: string | null;
    size: number;
    language: string | null;
  };

  if (metaData.private) {
    throw Object.assign(new Error('Private repositories are not supported'), { code: 'PRIVATE_REPOSITORY_UNSUPPORTED' });
  }

  const metadata: RepoMetadata = {
    fullName: metaData.full_name,
    defaultBranch: metaData.default_branch,
    isPrivate: metaData.private,
    description: metaData.description,
    size: metaData.size,
    language: metaData.language,
  };

  const resolvedRef = ref ?? metaData.default_branch;

  // 2. Fetch recursive Git tree
  const treeUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(resolvedRef)}?recursive=1`;
  const treeResp = await fetch(treeUrl, { headers, signal });

  if (!treeResp.ok) {
    throw Object.assign(new Error('Failed to fetch repository tree'), { code: 'GITHUB_FETCH_FAILED' });
  }

  const treeData = await treeResp.json() as { tree: GitHubTreeItem[]; truncated: boolean };
  const rawTree = Array.isArray(treeData.tree) ? treeData.tree : [];

  // 3. Filter to allowlisted files, bounded to MAX_TREE_ITEMS to guard heap memory
  const boundedTree = rawTree.length > LIMITS.MAX_TREE_ITEMS
    ? rawTree.slice(0, LIMITS.MAX_TREE_ITEMS)
    : rawTree;

  const candidates = boundedTree.filter(item => shouldFetchFile(item, referencedFiles));

  // 4. Fetch files concurrently with limit
  const files: GitHubFile[] = [];
  let totalChars = 0;
  let filesAttempted = 0;

  // Sort: config files first, then source
  candidates.splice(0, candidates.length, ...rankCandidateFiles(candidates, referencedFiles));

  const toFetch = candidates.slice(0, LIMITS.FETCHED_FILES_MAX);

  // Fetch in batches
  for (let i = 0; i < toFetch.length; i += LIMITS.GITHUB_CONCURRENT_FETCHES) {
    if (totalChars >= LIMITS.FETCHED_CONTENT_MAX_CHARS) break;
    if (files.length >= LIMITS.FETCHED_FILES_MAX) break;

    const batch = toFetch.slice(i, i + LIMITS.GITHUB_CONCURRENT_FETCHES);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        filesAttempted++;
        const contentUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${item.path}?ref=${encodeURIComponent(resolvedRef)}`;
        const timeoutSignal = AbortSignal.timeout(LIMITS.GITHUB_FETCH_TIMEOUT_MS);
        const fileSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
        const resp = await fetch(contentUrl, {
          headers,
          signal: fileSignal,
        });

        if (!resp.ok) return null;

        const data = await resp.json() as { content?: string; encoding?: string; size?: number };
        if (!data.content || data.encoding !== 'base64') return null;

        const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
        const redacted = redactFileContent(item.path, decoded);
        if (!redacted) return null;

        return { path: item.path, content: redacted, size: data.size ?? decoded.length };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        const file = result.value;
        if (totalChars + file.content.length > LIMITS.FETCHED_CONTENT_MAX_CHARS) {
          break;
        }
        files.push(file);
        totalChars += file.content.length;
      }
    }
  }

  return {
    metadata,
    files,
    resolvedRef,
    rateLimit,
    filesAttempted,
    totalFetchedChars: totalChars,
  };
}
