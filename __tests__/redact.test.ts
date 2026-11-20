import { describe, it, expect } from 'vitest';
import { redactSecrets, redactFileContent } from '@/lib/redact';

describe('redactSecrets', () => {
  it('redacts GitHub PAT tokens', () => {
    const { redacted, count } = redactSecrets('Using token: ghp_abcdef1234567890abcdefghijklmnop1234');
    expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(count).toBeGreaterThan(0);
    expect(redacted).not.toContain('ghp_');
  });

  it('redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const { redacted } = redactSecrets(`Authorization: Bearer ${jwt}`);
    expect(redacted).toContain('[REDACTED');
    expect(redacted).not.toContain(jwt);
  });

  it('redacts AWS access keys', () => {
    const { redacted } = redactSecrets('key: AKIAIOSFODNN7EXAMPLE');
    expect(redacted).toContain('[REDACTED_AWS_KEY]');
  });

  it('redacts database connection strings', () => {
    const { redacted } = redactSecrets('DATABASE_URL=postgresql://user:password@host:5432/db');
    expect(redacted).toContain('[REDACTED_DB_URL]');
    expect(redacted).not.toContain('password');
  });

  it('redacts sensitive query parameters', () => {
    const { redacted } = redactSecrets('https://api.example.com/data?token=supersecret123&foo=bar');
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).not.toContain('supersecret123');
    // foo=bar should be kept (not sensitive)
    expect(redacted).toContain('foo=bar');
  });

  it('does not redact normal error messages', () => {
    const log = 'Module not found: Error: Cannot resolve module react';
    const { redacted } = redactSecrets(log);
    expect(redacted).toContain('Module not found');
    expect(redacted).toContain('react');
  });

  it('does not redact package names', () => {
    const log = 'npm install @tailwindcss/postcss@4.0.0';
    const { redacted } = redactSecrets(log);
    expect(redacted).toContain('tailwindcss');
    expect(redacted).toContain('postcss');
  });

  it('redacts private key blocks', () => {
    const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
    const { redacted } = redactSecrets(key);
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('redacts Bearer tokens in authorization headers', () => {
    const { redacted } = redactSecrets('Authorization: Bearer eyJsometoken12345678901234567890');
    expect(redacted).toContain('[REDACTED');
  });

  it('handles long strings without catastrophic backtracking (ReDoS safety)', () => {
    const longString = 'Bearer ' + 'a'.repeat(3000) + '!';
    const start = Date.now();
    const { redacted } = redactSecrets(longString);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(redacted).toBeDefined();
  });
});

describe('redactFileContent', () => {
  it('blocks .env files', () => {
    const result = redactFileContent('.env', 'API_KEY=secret');
    expect(result).toBeNull();
  });

  it('blocks .env.local files', () => {
    const result = redactFileContent('.env.local', 'DATABASE_URL=secret');
    expect(result).toBeNull();
  });

  it('allows package.json', () => {
    const content = '{"name": "my-app", "version": "1.0.0"}';
    const result = redactFileContent('package.json', content);
    expect(result).not.toBeNull();
    expect(result).toContain('my-app');
  });

  it('redacts secrets in allowed files', () => {
    const content = 'const token = "ghp_1234567890abcdefghij1234567890";\nconsole.log("hello");';
    const result = redactFileContent('config.ts', content);
    expect(result).not.toBeNull();
    expect(result).not.toContain('ghp_');
    expect(result).toContain('hello');
  });
});
