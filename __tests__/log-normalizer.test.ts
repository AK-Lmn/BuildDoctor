import { describe, it, expect } from 'vitest';
import { normalizeBuildLog, stripAnsi } from '@/lib/log-normalizer';

describe('stripAnsi', () => {
  it('removes color escape codes', () => {
    const ansi = '\x1b[31mError\x1b[0m: Something failed';
    expect(stripAnsi(ansi)).toBe('Error: Something failed');
  });

  it('removes bold/italic escape codes', () => {
    const ansi = '\x1b[1mBold\x1b[0m text';
    expect(stripAnsi(ansi)).toBe('Bold text');
  });

  it('leaves plain text unchanged', () => {
    const plain = 'Module not found: react';
    expect(stripAnsi(plain)).toBe(plain);
  });

  it('removes multiple escape sequences', () => {
    const ansi = '\x1b[32m✓\x1b[0m \x1b[31mError\x1b[0m';
    expect(stripAnsi(ansi)).toBe('✓ Error');
  });
});

describe('normalizeBuildLog', () => {
  it('normalizes CRLF line endings', () => {
    const log = 'line1\r\nline2\r\nline3';
    const result = normalizeBuildLog(log);
    expect(result.originalLineCount).toBe(3);
    expect(result.normalizedLineCount).toBeGreaterThan(0);
  });

  it('preserves original line count', () => {
    const log = 'line1\nline2\nline3\nline4\nline5';
    const result = normalizeBuildLog(log);
    expect(result.originalLineCount).toBe(5);
  });

  it('strips ANSI codes before processing', () => {
    const log = '\x1b[31mError: Module not found\x1b[0m\nDetails here';
    const result = normalizeBuildLog(log);
    // Should have detected MODULE_NOT_FOUND signal
    expect(result.matchedSignals.some(s => s.category === 'MODULE_NOT_FOUND')).toBe(true);
  });

  it('collapses excessive blank lines', () => {
    const log = 'line1\n\n\n\n\n\nline2';
    const result = normalizeBuildLog(log);
    expect(result.normalizedLineCount).toBeLessThan(8);
  });

  it('detects MODULE_NOT_FOUND signal', () => {
    const log = "error - Module not found: Can't resolve '@/components/Header'";
    const result = normalizeBuildLog(log);
    expect(result.matchedSignals.some(s => s.category === 'MODULE_NOT_FOUND')).toBe(true);
  });

  it('detects TYPESCRIPT_ERROR signal', () => {
    const log = 'src/app/page.tsx(12,25): error TS2339: Property does not exist on type';
    const result = normalizeBuildLog(log);
    expect(result.matchedSignals.some(s => s.category === 'TYPESCRIPT_ERROR')).toBe(true);
  });

  it('detects PEER_DEPENDENCY_CONFLICT signal', () => {
    const log = 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree';
    const result = normalizeBuildLog(log);
    expect(result.matchedSignals.some(s => s.category === 'PEER_DEPENDENCY_CONFLICT')).toBe(true);
  });

  it('detects VERCEL_FUNCTION_TIMEOUT signal', () => {
    const log = 'Error: FUNCTION_INVOCATION_TIMEOUT\nFunction timed out after 10 seconds';
    const result = normalizeBuildLog(log);
    expect(result.matchedSignals.some(s => s.category === 'VERCEL_FUNCTION_TIMEOUT')).toBe(true);
  });

  it('detects OUT_OF_MEMORY signal', () => {
    const log = 'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory';
    const result = normalizeBuildLog(log);
    expect(result.matchedSignals.some(s => s.category === 'OUT_OF_MEMORY')).toBe(true);
  });

  it('marks truncation when log is too large', () => {
    // Create a multi-line log much larger than BUILD_LOG_MAX_CHARS (200K)
    // Use realistic build output that won't be redacted as fake tokens
    // Lines contain spaces and varied content to avoid base64-pattern redaction
    const lineContent = 'Compiling module dependencies and resolving paths for build output step';
    const bigLog = Array.from({ length: 3000 }, (_, i) => `[${i}] info: ${lineContent}`).join('\n');
    // Verify the test log is actually big enough
    expect(bigLog.length).toBeGreaterThan(250_000);
    const result = normalizeBuildLog(bigLog);
    expect(result.wasTruncated).toBe(true);
    expect(result.omittedLineCount).toBeGreaterThan(0);
  });

  it('does not truncate small logs', () => {
    const log = 'Small log\nJust two lines';
    const result = normalizeBuildLog(log);
    expect(result.wasTruncated).toBe(false);
  });

  it('caps excessively long lines', () => {
    const longLine = 'x'.repeat(5000);
    const result = normalizeBuildLog(longLine);
    // The normalized output should be shorter than the original
    expect(result.normalizedLineCount).toBeGreaterThan(0);
    // The final lines should all be <= LOG_LINE_MAX_CHARS + suffix length
    const allSectionText = result.sections.map(s => s.text).join('\n');
    // Either sections contain the truncated marker, or the content was capped (check length)
    // A 5000-char line gets capped to 2000 + suffix (~50 chars) = ~2050
    // The full 5000 chars should NOT appear
    expect(allSectionText.length).toBeLessThan(5000);
  });

  it('redacts secrets and tracks count', () => {
    const log = 'Token: ghp_abcdef1234567890abcdef1234567890ab\nError occurred';
    const result = normalizeBuildLog(log);
    expect(result.redactedCount).toBeGreaterThan(0);
  });

  it('detects MISSING_ENVIRONMENT_VARIABLE signal', () => {
    const log = 'Error: process.env.API_KEY is undefined\nEnvironment variable not set';
    const result = normalizeBuildLog(log);
    expect(result.matchedSignals.some(s => s.category === 'MISSING_ENVIRONMENT_VARIABLE')).toBe(true);
  });
});
