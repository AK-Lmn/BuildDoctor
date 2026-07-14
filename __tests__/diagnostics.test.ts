import { describe, it, expect } from 'vitest';
import { runDeterministicDiagnostics, rankFindings } from '@/lib/diagnostics';
import type { GitHubFile } from '@/lib/github/client';
import type { NormalizedLog } from '@/lib/types';

function makeFile(path: string, content: string): GitHubFile {
  return { path, content, size: content.length };
}

function makeLog(signals: Array<{ category: string; excerpt: string; lineNumber?: number }>): NormalizedLog {
  return {
    originalLineCount: 100,
    normalizedLineCount: 100,
    wasTruncated: false,
    sections: [],
    matchedSignals: signals.map((s, i) => ({
      pattern: 'test',
      lineNumber: s.lineNumber ?? i + 1,
      excerpt: s.excerpt,
      category: s.category as NormalizedLog['matchedSignals'][0]['category'],
    })),
    redactedCount: 0,
  };
}

describe('runDeterministicDiagnostics', () => {
  it('returns empty array for empty inputs', () => {
    const findings = runDeterministicDiagnostics(null, [], {});
    expect(findings).toHaveLength(0);
  });

  it('detects competing lockfiles', () => {
    const files = [
      makeFile('package-lock.json', '{"lockfileVersion": 3}'),
      makeFile('yarn.lock', '__metadata:\n  version: 6'),
    ];
    const findings = runDeterministicDiagnostics(null, files, {});
    expect(findings.some(f => f.category === 'LOCKFILE_CONFLICT')).toBe(true);
  });

  it('detects missing build script', () => {
    const pkgJson = JSON.stringify({ name: 'test', scripts: { dev: 'next dev' } });
    const files = [makeFile('package.json', pkgJson)];
    const findings = runDeterministicDiagnostics(null, files, {});
    expect(findings.some(f => f.category === 'BUILD_SCRIPT_MISSING')).toBe(true);
    expect(findings.find(f => f.category === 'BUILD_SCRIPT_MISSING')?.severity).toBe('critical');
  });

  it('does NOT flag missing build script when build exists', () => {
    const pkgJson = JSON.stringify({ name: 'test', scripts: { build: 'next build', dev: 'next dev' } });
    const files = [makeFile('package.json', pkgJson)];
    const findings = runDeterministicDiagnostics(null, files, {});
    expect(findings.some(f => f.category === 'BUILD_SCRIPT_MISSING')).toBe(false);
  });

  it('detects malformed package.json', () => {
    const files = [makeFile('package.json', '{ invalid json }')];
    const findings = runDeterministicDiagnostics(null, files, {});
    expect(findings.some(f => f.category === 'INVALID_PACKAGE_SCRIPT')).toBe(true);
  });

  it('detects duplicate dependencies', () => {
    const pkg = JSON.stringify({
      dependencies: { react: '^18.0.0', typescript: '^5.0.0' },
      devDependencies: { react: '^18.0.0', vitest: '^1.0.0' },
    });
    const files = [makeFile('package.json', pkg)];
    const findings = runDeterministicDiagnostics(null, files, {});
    expect(findings.some(f => f.category === 'PEER_DEPENDENCY_CONFLICT')).toBe(true);
  });

  it('detects package manager mismatch', () => {
    const pkg = JSON.stringify({ name: 'test', packageManager: 'pnpm@8.0.0' });
    const files = [
      makeFile('package.json', pkg),
      makeFile('package-lock.json', '{"lockfileVersion": 3}'),
    ];
    const findings = runDeterministicDiagnostics(null, files, { packageManager: 'pnpm', lockfiles: ['package-lock.json'] });
    expect(findings.some(f => f.category === 'PACKAGE_MANAGER_MISMATCH')).toBe(true);
  });

  it('generates findings from MODULE_NOT_FOUND signal', () => {
    const log = makeLog([
      { category: 'MODULE_NOT_FOUND', excerpt: "Can't resolve '@/components/Header'" },
    ]);
    const findings = runDeterministicDiagnostics(log, [], {});
    expect(findings.some(f => f.category === 'MODULE_NOT_FOUND')).toBe(true);
  });

  it('generates findings from TYPESCRIPT_ERROR signal', () => {
    const log = makeLog([
      { category: 'TYPESCRIPT_ERROR', excerpt: 'error TS2339: Property does not exist' },
    ]);
    const findings = runDeterministicDiagnostics(log, [], {});
    expect(findings.some(f => f.category === 'TYPESCRIPT_ERROR')).toBe(true);
  });

  it('ranks critical findings first', () => {
    const log = makeLog([
      { category: 'HYDRATION_WARNING', excerpt: 'hydration mismatch' },
      { category: 'MODULE_NOT_FOUND', excerpt: 'module not found' },
    ]);
    const findings = runDeterministicDiagnostics(log, [], {});
    expect(findings[0].category).toBe('MODULE_NOT_FOUND');
  });

  it('limits findings to FINDINGS_MAX', () => {
    const signals = Array.from({ length: 20 }, (_, i) => ({
      category: 'TYPESCRIPT_ERROR',
      excerpt: `error TS2339 line ${i}`,
      lineNumber: i + 1,
    }));
    const log = makeLog(signals);
    const findings = runDeterministicDiagnostics(log, [], {});
    expect(findings.length).toBeLessThanOrEqual(12);
  });
});

describe('rankFindings', () => {
  it('sorts by severity then confidence', () => {
    const input = [
      { id: '1', category: 'TYPESCRIPT_ERROR' as const, severity: 'medium' as const, confidence: 'high' as const, title: '', summary: '', evidence: [], recommendedAction: '' },
      { id: '2', category: 'MODULE_NOT_FOUND' as const, severity: 'critical' as const, confidence: 'medium' as const, title: '', summary: '', evidence: [], recommendedAction: '' },
      { id: '3', category: 'HYDRATION_WARNING' as const, severity: 'low' as const, confidence: 'high' as const, title: '', summary: '', evidence: [], recommendedAction: '' },
    ];
    const ranked = rankFindings(input);
    expect(ranked[0].id).toBe('2'); // critical first
    expect(ranked[ranked.length - 1].id).toBe('3'); // low last
  });
});
