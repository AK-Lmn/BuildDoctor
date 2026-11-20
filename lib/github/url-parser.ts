/**
 * GitHub URL validator — parses and validates public GitHub repository URLs.
 * Rejects private repos, embedded credentials, non-GitHub hosts, etc.
 */

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  ref?: string;
}

const VALID_NAME_RE = /^[a-zA-Z0-9_.-]+$/;
const UNSAFE_PROTOCOLS = /^(javascript|data|vbscript|ftp|file):/i;
const PRIVATE_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/ ;

/**
 * Parse and validate a GitHub repository URL.
 * Returns the parsed result or throws with a descriptive message.
 */
export function parseGitHubUrl(rawUrl: string): ParsedGitHubUrl {
  const url = rawUrl.trim();

  if (!url) {
    throw new Error('Repository URL is required');
  }

  if (url.length > 2048) {
    throw new Error('Repository URL exceeds maximum length');
  }

  // Parse URL first so we can detect credentials before any prefix check
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Try prefix check for better error messages
    if (UNSAFE_PROTOCOLS.test(url)) {
      throw new Error('Invalid URL protocol');
    }
    throw new Error('Malformed repository URL');
  }

  // Reject unsafe protocols
  if (UNSAFE_PROTOCOLS.test(url)) {
    throw new Error('Invalid URL protocol');
  }

  // Reject embedded credentials before any other checks
  if (parsed.username || parsed.password) {
    throw new Error('Repository URL must not contain embedded credentials — remove credentials from the URL');
  }

  // Enforce host is exactly github.com
  if (parsed.hostname !== 'github.com') {
    if (/^https?:\/\//.test(url)) {
      throw new Error('Only public GitHub repositories (github.com) are supported in this MVP');
    }
    throw new Error('Repository URL must start with https://github.com/');
  }

  // Enforce https scheme
  if (parsed.protocol !== 'https:') {
    throw new Error('Repository URL must use HTTPS');
  }

  // Reject query parameters (could carry tokens)
  const dangerousParams = ['token', 'key', 'api_key', 'password', 'secret', 'auth', 'session', 'code', 'signature'];
  for (const param of dangerousParams) {
    if (parsed.searchParams.has(param)) {
      throw new Error('Repository URL must not contain authentication parameters');
    }
  }

  // Reject private/local hosts (shouldn't be reachable via github.com, but validate the resolved host)
  if (PRIVATE_HOSTS.test(parsed.hostname)) {
    throw new Error('Repository URL points to a private or local destination');
  }

  // Parse path segments
  const pathParts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (pathParts.length < 2) {
    throw new Error('Repository URL must contain owner and repository name');
  }

  const [owner, rawRepo, treeKeyword, ...refParts] = pathParts;

  // Validate owner
  if (!owner || !VALID_NAME_RE.test(owner)) {
    throw new Error(`Invalid repository owner: "${owner}"`);
  }

  // Strip .git suffix
  const repo = rawRepo.replace(/\.git$/, '');

  if (!repo || !VALID_NAME_RE.test(repo)) {
    throw new Error(`Invalid repository name: "${rawRepo}"`);
  }

  // Reject special GitHub pages
  const REJECTED_PATHS = ['issues', 'pulls', 'settings', 'actions', 'releases', 'security', 'wiki', 'projects', 'packages', 'discussions', 'compare'];
  if (treeKeyword && REJECTED_PATHS.includes(treeKeyword.toLowerCase())) {
    throw new Error(`Repository URL appears to point to a "${treeKeyword}" page, not a repository root or branch`);
  }

  // Extract ref from /tree/<ref> pattern
  let ref: string | undefined;
  if (treeKeyword === 'tree' && refParts.length > 0) {
    ref = refParts.join('/');
    if (ref.length > 200) {
      throw new Error('Git ref exceeds maximum length');
    }
  }

  return { owner, repo, ref };
}

/**
 * Build a safe GitHub API base URL from validated components.
 */
export function buildApiUrl(base: string, ...segments: string[]): string {
  const encoded = segments.map(s => encodeURIComponent(s));
  return [base, ...encoded].join('/');
}
