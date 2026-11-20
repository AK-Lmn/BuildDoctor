/**
 * Build-log normalization pipeline.
 */

import { LIMITS } from './config';
import { redactSecrets } from './redact';
import type {
  NormalizedLog,
  LogSection,
  DiagnosticSignal,
  DiagnosticCategory,
} from './types';

// ── ANSI stripping ────────────────────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*[mGKFHJlh]|\x1b[()][AB012]|\x1b[>=]|\x07|\x08|\r(?!\n)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}

// ── Platform prefix / timestamp stripping ────────────────────────────────────


// ── Diagnostic signal patterns ────────────────────────────────────────────────

interface SignalPattern {
  re: RegExp;
  category: DiagnosticCategory;
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  { re: /Module not found|Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/i, category: 'MODULE_NOT_FOUND' },
  { re: /Can't resolve/i, category: 'MODULE_NOT_FOUND' },
  { re: /ERESOLVE|peer dep|conflicting peer/i, category: 'PEER_DEPENDENCY_CONFLICT' },
  { re: /ENOENT/i, category: 'MODULE_NOT_FOUND' },
  { re: /ELIFECYCLE/i, category: 'INVALID_PACKAGE_SCRIPT' },
  { re: /ETIMEDOUT|ECONNRESET|ECONNREFUSED/i, category: 'NETWORK_OR_REGISTRY_FAILURE' },
  { re: /error TS\d{4}/i, category: 'TYPESCRIPT_ERROR' },
  { re: /Type error:/i, category: 'TYPESCRIPT_ERROR' },
  { re: /ESLint|no-unused-vars|@typescript-eslint/i, category: 'ESLINT_ERROR' },
  { re: /npm ERR! missing script/i, category: 'BUILD_SCRIPT_MISSING' },
  { re: /pnpm ERR!|yarn error/i, category: 'INVALID_PACKAGE_SCRIPT' },
  { re: /FUNCTION_INVOCATION_TIMEOUT|vercel.*timeout/i, category: 'VERCEL_FUNCTION_TIMEOUT' },
  { re: /FUNCTION_PAYLOAD_TOO_LARGE/i, category: 'VERCEL_PAYLOAD_LIMIT' },
  { re: /out of memory|JavaScript heap out of memory/i, category: 'OUT_OF_MEMORY' },
  { re: /EACCES|permission denied/i, category: 'PERMISSION_ERROR' },
  { re: /pnpm-lock\.yaml|yarn\.lock|package-lock\.json|bun\.lock/i, category: 'LOCKFILE_CONFLICT' },
  { re: /engines.*node|node.*engines|required node/i, category: 'NODE_VERSION_MISMATCH' },
  { re: /env.*not set|Missing.*env|process\.env\.\w+ is undefined/i, category: 'MISSING_ENVIRONMENT_VARIABLE' },
  { re: /getStaticProps.*pages router|app.*directory.*static/i, category: 'NEXT_STATIC_EXPORT_ERROR' },
  { re: /Client Component.*Server|Server Component.*client/i, category: 'NEXT_SERVER_CLIENT_BOUNDARY' },
  { re: /hydration|Hydration/i, category: 'HYDRATION_WARNING' },
  { re: /next\.config/i, category: 'NEXT_CONFIG_ERROR' },
  { re: /vite\.config/i, category: 'VITE_CONFIG_ERROR' },
  { re: /rate limit|429|API rate/i, category: 'RATE_LIMIT' },
  { re: /deprecated|DEPRECATED/i, category: 'DEPRECATED_PACKAGE' },
];

// ── Section detection ─────────────────────────────────────────────────────────

function detectSectionKind(lines: string[]): LogSection['kind'] {
  const text = lines.join('\n').toLowerCase();

  if (/^\s*[>$]\s+\S+/.test(lines[0] ?? '')) return 'command';
  if (/error|failed|failure|fatal|exception/i.test(text)) {
    if (/^\s+at\s+\S+/.test(lines[1] ?? '') || /stack trace/i.test(text)) return 'stack';
    return 'error';
  }
  if (/warn(?:ing)?/i.test(text)) return 'warning';
  if (/^done|complete|success|finished/i.test(text)) return 'summary';
  return 'unknown';
}

// ── Main normalize function ───────────────────────────────────────────────────

export function normalizeBuildLog(rawLog: string): NormalizedLog {
  // 1. Normalize line endings
  const normalized = rawLog.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const originalLines = normalized.split('\n');
  const originalLineCount = originalLines.length;

  // 2. Strip ANSI codes
  const ansiStripped = originalLines.map(l => stripAnsi(l));

  // 3. Redact secrets
  const { redacted: redactedText, count: redactedCount } = redactSecrets(ansiStripped.join('\n'));
  const redactedLines = redactedText.split('\n');

  // 4. Cap excessively long lines
  const cappedLines = redactedLines.map(line =>
    line.length > LIMITS.LOG_LINE_MAX_CHARS
      ? line.slice(0, LIMITS.LOG_LINE_MAX_CHARS) + ` …[line truncated at ${LIMITS.LOG_LINE_MAX_CHARS} chars]`
      : line
  );

  // 5. Collapse excessive blank lines (max 2 consecutive)
  const collapsedLines: string[] = [];
  let blankRun = 0;
  for (const line of cappedLines) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 2) collapsedLines.push(line);
    } else {
      blankRun = 0;
      collapsedLines.push(line);
    }
  }

  // 6. Detect signals
  const matchedSignals: DiagnosticSignal[] = [];
  for (let i = 0; i < collapsedLines.length; i++) {
    const line = collapsedLines[i];
    for (const { re, category } of SIGNAL_PATTERNS) {
      if (re.test(line)) {
        matchedSignals.push({
          pattern: re.source,
          lineNumber: i + 1,
          excerpt: line.trim().slice(0, 300),
          category,
        });
        break; // one signal per line
      }
    }
  }

  // 7. Truncation with preservation
  let wasTruncated = false;
  let omittedLineCount: number | undefined;
  let finalLines = collapsedLines;

  let totalCollapsedChars = 0;
  for (let i = 0; i < collapsedLines.length; i++) {
    totalCollapsedChars += collapsedLines[i].length + (i > 0 ? 1 : 0);
  }

  if (totalCollapsedChars > LIMITS.BUILD_LOG_MAX_CHARS) {
    wasTruncated = true;
    // Preserve first 40% and last 40% by char count
    const targetChars = LIMITS.BUILD_LOG_MAX_CHARS;
    const halfChars = Math.floor(targetChars * 0.4);

    const startLines: string[] = [];
    let startChars = 0;
    for (const line of collapsedLines) {
      if (startChars + line.length > halfChars) break;
      startLines.push(line);
      startChars += line.length + 1;
    }

    const endLines: string[] = [];
    let endChars = 0;
    for (let i = collapsedLines.length - 1; i >= 0; i--) {
      const line = collapsedLines[i];
      if (endChars + line.length > halfChars) break;
      endLines.unshift(line);
      endChars += line.length + 1;
    }

    omittedLineCount = collapsedLines.length - startLines.length - endLines.length;
    const omitMsg = `[... ${omittedLineCount} lines omitted — beginning and final error region preserved ...]`;
    finalLines = [...startLines, omitMsg, ...endLines];
  }

  // 8. Build sections
  const sections: LogSection[] = [];
  let sectionBuffer: string[] = [];
  let sectionStart = 0;
  let sectionId = 0;

  function flushSection(endLine: number) {
    if (sectionBuffer.length === 0) return;
    const kind = detectSectionKind(sectionBuffer);
    sections.push({
      id: `s${sectionId++}`,
      startLine: sectionStart,
      endLine,
      kind,
      text: sectionBuffer.join('\n'),
    });
    sectionBuffer = [];
  }

  for (let i = 0; i < finalLines.length; i++) {
    const line = finalLines[i];
    const isCommand = /^\s*[>$✓✗]\s+\S+/.test(line);
    const isError = /\b(?:error|failed|failure|fatal|exception|panic)\b/i.test(line);

    if ((isCommand || isError) && sectionBuffer.length > 10) {
      flushSection(i);
      sectionStart = i;
    }

    sectionBuffer.push(line);
  }
  flushSection(finalLines.length);

  return {
    originalLineCount,
    normalizedLineCount: finalLines.length,
    wasTruncated,
    omittedLineCount,
    sections,
    matchedSignals,
    redactedCount,
  };
}

/**
 * Extract a representative excerpt for AI prompting.
 * Prioritizes error sections and matched signals.
 */
export function extractLogExcerpt(log: NormalizedLog, maxChars: number): string {
  const errorSections = log.sections.filter(s => s.kind === 'error' || s.kind === 'stack');
  const lines = errorSections.map(s => s.text).join('\n\n');

  if (lines.length <= maxChars) {
    // Include some context from the end of other sections
    const allText = log.sections.map(s => s.text).join('\n\n');
    return allText.slice(0, maxChars);
  }

  return lines.slice(0, maxChars);
}
