import { describe, it, expect } from 'vitest';
import { runDeterministicDiagnostics } from '@/lib/diagnostics';
import { normalizeBuildLog } from '@/lib/log-normalizer';
import { detectProject } from '@/lib/detect-project';
import { buildDeterministicReport } from '@/lib/gemini';
import { DiagnoseResponse } from '@/lib/types';
import type { GitHubFile } from '@/lib/github/client';

/**
 * Integration test: full pipeline without external API calls.
 * Validates: input → log normalization → repo detection → diagnostics → report
 */

function makeFile(path: string, content: string): GitHubFile {
  return { path, content, size: content.length };
}

describe('Full pipeline integration (mocked)', () => {
  it('handles Next.js module-not-found scenario end-to-end', () => {
    // 1. User input
    const buildLog = `
> next build

info - Loaded env from .env.local
error - ./app/components/Header.tsx
Module not found: Can't resolve '@/components/layout/Header'

Import trace for requested module:
./app/page.tsx
./app/layout.tsx

./app/page.tsx
error TS2339: Property 'title' does not exist on type 'PageProps'

> Build failed because of webpack errors
Error: Command failed with exit code 1
    `.trim();

    const repoFiles: GitHubFile[] = [
      makeFile('package.json', JSON.stringify({
        name: 'my-next-app',
        scripts: { build: 'next build', dev: 'next dev' },
        dependencies: { next: '^15.0.0', react: '^19.0.0' },
      })),
      makeFile('tsconfig.json', JSON.stringify({
        compilerOptions: {
          paths: { '@/*': ['./src/*'] },
        },
      })),
      makeFile('next.config.ts', 'import type { NextConfig } from "next";\nexport default {} satisfies NextConfig;'),
    ];

    // 2. Log normalization
    const normalizedLog = normalizeBuildLog(buildLog);
    expect(normalizedLog.originalLineCount).toBeGreaterThan(0);
    expect(normalizedLog.matchedSignals.length).toBeGreaterThan(0);
    expect(normalizedLog.matchedSignals.some(s => s.category === 'MODULE_NOT_FOUND')).toBe(true);
    expect(normalizedLog.matchedSignals.some(s => s.category === 'TYPESCRIPT_ERROR')).toBe(true);

    // 3. Project detection
    const snapshot = detectProject(repoFiles, 'test/my-next-app', 'main');
    expect(snapshot.framework).toBe('Next.js');
    expect(snapshot.typescriptUsage).toBe(true);
    expect(snapshot.buildCommand).toBe('next build');
    expect(snapshot.pathAliases).toBeDefined();
    expect(snapshot.pathAliases?.['@/*']).toBeDefined();

    // 4. Deterministic diagnostics
    const findings = runDeterministicDiagnostics(normalizedLog, repoFiles, snapshot);
    expect(findings.length).toBeGreaterThan(0);
    // MODULE_NOT_FOUND should be in findings
    expect(findings.some(f => f.category === 'MODULE_NOT_FOUND')).toBe(true);
    // Critical findings should come first
    expect(findings[0].severity).toMatch(/critical|high/);

    // 5. Build report (without AI)
    const report = buildDeterministicReport(findings);
    expect(report.status).toMatch(/diagnosed|partial/);
    expect(report.usedAI).toBe(false);
    expect(report.repairPlan.length).toBeGreaterThan(0);
    expect(report.unresolvedQuestions.length).toBeGreaterThan(0);

    // 6. Validate response shape
    const response: DiagnoseResponse = {
      projectSnapshot: snapshot,
      deterministicFindings: findings,
      report,
      filesInspected: repoFiles.map(f => f.path),
      aiUsed: false,
      aiSynthesisState: 'not-configured',
      processingMs: 500,
    };

    expect(response.projectSnapshot?.framework).toBe('Next.js');
    expect(response.deterministicFindings.length).toBeGreaterThan(0);
    expect(response.report.primaryDiagnosis.category).toBe('MODULE_NOT_FOUND');
  });

  it('handles log-only mode (no repository)', () => {
    const buildLog = 'npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree';
    
    const normalizedLog = normalizeBuildLog(buildLog);
    expect(normalizedLog.matchedSignals.some(s => s.category === 'PEER_DEPENDENCY_CONFLICT')).toBe(true);

    const findings = runDeterministicDiagnostics(normalizedLog, [], {});
    expect(findings.length).toBeGreaterThan(0);

    const report = buildDeterministicReport(findings);
    expect(report.status).toMatch(/diagnosed|partial/);
    expect(report.usedAI).toBe(false);
  });

  it('handles empty input gracefully (no log, no repo)', () => {
    const findings = runDeterministicDiagnostics(null, [], {});
    expect(findings).toHaveLength(0);

    const report = buildDeterministicReport(findings);
    expect(report.status).toBe('insufficient-evidence');
    expect(report.primaryDiagnosis.category).toBe('UNKNOWN');
  });

  it('does not expose secrets in findings', () => {
    const buildLog = `
Token used: ghp_abcdef1234567890abcdefghijklmn12345
Error: Module not found: Can't resolve 'react'
    `.trim();

    const normalizedLog = normalizeBuildLog(buildLog);
    // Log should be redacted
    const allExcerpts = normalizedLog.matchedSignals.map(s => s.excerpt).join(' ');
    expect(allExcerpts).not.toContain('ghp_abcdef');

    // Findings built from signals should not contain the token
    const findings = runDeterministicDiagnostics(normalizedLog, [], {});
    const findingStr = JSON.stringify(findings);
    expect(findingStr).not.toContain('ghp_abcdef');
  });
});
