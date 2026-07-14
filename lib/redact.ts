/**
 * Secret redaction — removes likely credentials from text before AI processing.
 */

interface RedactionResult {
  redacted: string;
  count: number;
}

// Patterns for secrets — ordered from most specific to most general
const REDACTION_PATTERNS: Array<{ pattern: RegExp; placeholder: string }> = [
  // Private keys (PEM blocks)
  {
    pattern: /-----BEGIN[A-Z ]+PRIVATE KEY-----[\s\S]*?-----END[A-Z ]+PRIVATE KEY-----/g,
    placeholder: '[REDACTED_PRIVATE_KEY]',
  },
  // JWTs (three base64url segments)
  {
    pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    placeholder: '[REDACTED_JWT]',
  },
  // GitHub personal access tokens / fine-grained
  {
    pattern: /(?:ghp|ghs|gho|ghr|github_pat)_[a-zA-Z0-9]{20,}/g,
    placeholder: '[REDACTED_GITHUB_TOKEN]',
  },
  // Bearer tokens in headers
  {
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]{20,}={0,2}/gi,
    placeholder: 'Bearer [REDACTED_TOKEN]',
  },
  // Authorization headers
  {
    pattern: /(?:Authorization|x-api-key|x-auth-token|x-access-token)\s*[:=]\s*["']?[a-zA-Z0-9\-._~+/]{10,}["']?/gi,
    placeholder: '[REDACTED_AUTH_HEADER]',
  },
  // AWS-style keys
  {
    pattern: /(?:AKIA|ASIA|AROA)[A-Z0-9]{16}/g,
    placeholder: '[REDACTED_AWS_KEY]',
  },
  // Database connection strings
  {
    pattern: /(?:mongodb|postgresql|mysql|redis|amqp)\+?:\/\/[^@\s"']+:[^@\s"']+@[^\s"']+/gi,
    placeholder: '[REDACTED_DB_URL]',
  },
  // Sensitive query params — token, key, secret, password, auth, session, code, signature, api_key
  {
    pattern: /([?&](?:token|api[_-]?key|password|secret|auth|session|code|signature|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)=)[^\s&"'#]{4,}/gi,
    placeholder: '$1[REDACTED]',
  },
  // Environment variable assignments with secrets
  {
    pattern: /(?:^|[\s;,])(?:API[_-]?KEY|SECRET[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|CLIENT[_-]?SECRET|PRIVATE[_-]?KEY|PASSWORD|PASSWD|AUTH[_-]?TOKEN|SERVICE[_-]?ACCOUNT[_-]?KEY)\s*=\s*["']?[a-zA-Z0-9\-._~+/]{8,}["']?/gim,
    placeholder: ' [REDACTED_SECRET_ENV]',
  },
  // Signed URLs (S3, GCS, Azure with signatures)
  {
    pattern: /https?:\/\/[^\s"']*(?:X-Amz-Signature|X-Goog-Signature|sig=)[^\s"']*/gi,
    placeholder: '[REDACTED_SIGNED_URL]',
  },
  // Cookie values
  {
    pattern: /(?:Cookie|Set-Cookie)\s*:\s*[^\n\r]{0,500}/gi,
    placeholder: '[REDACTED_COOKIE]',
  },
  // Long hex strings that look like secrets (40+ hex chars)
  {
    pattern: /\b[a-f0-9]{40,}\b/g,
    placeholder: '[REDACTED_HEX_TOKEN]',
  },
  // Long random base64-like strings (32+ chars) — more conservative
  {
    pattern: /\b[a-zA-Z0-9+/]{32,}={0,2}\b/g,
    placeholder: '[REDACTED_TOKEN]',
  },
];

// Patterns that should NOT be redacted (common false-positive content)
const FALSE_POSITIVE_EXEMPTIONS = new Set([
  // Common SHA-like things that are not secrets
  'node_modules',
  'node-modules',
]);

export function redactSecrets(text: string): RedactionResult {
  let result = text;
  let count = 0;

  for (const { pattern, placeholder } of REDACTION_PATTERNS) {
    const replaced = result.replace(pattern, (match) => {
      // Skip obvious false positives
      if (FALSE_POSITIVE_EXEMPTIONS.has(match.toLowerCase())) {
        return match;
      }
      count++;
      return placeholder;
    });
    result = replaced;
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
  }

  return { redacted: result, count };
}

/**
 * Redact secrets from a single file path's content.
 * Returns null if the file appears to be a credential file.
 */
export function redactFileContent(filename: string, content: string): string | null {
  const lower = filename.toLowerCase();

  // Completely block credential files
  const BLOCKED_FILES = [
    '.env', '.env.local', '.env.production', '.env.development',
    '.env.staging', '.env.test', '.env.preview',
    'credentials.json', 'service-account.json', 'keyfile.json',
    '.pem', '.key', '.p12', '.pfx', '.cer',
    'id_rsa', 'id_ed25519', 'known_hosts',
  ];

  if (BLOCKED_FILES.some(b => lower === b || lower.endsWith(b))) {
    return null;
  }

  const { redacted } = redactSecrets(content);
  return redacted;
}
