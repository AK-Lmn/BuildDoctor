import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readDirectoryAsFiles, analyzeDirectory } from '@/lib/analyzer';

describe('readDirectoryAsFiles', () => {
  it('reads configuration files from a fixture directory and normalizes paths', () => {
    const fixtureDir = path.resolve(process.cwd(), 'fixtures/healthy-nextjs');
    const files = readDirectoryAsFiles(fixtureDir);

    expect(files.length).toBeGreaterThan(0);
    const paths = files.map(f => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('tsconfig.json');
    expect(paths).toContain('next.config.ts');

    const pkg = files.find(f => f.path === 'package.json');
    expect(pkg).toBeDefined();
    expect(pkg?.content).toContain('healthy-nextjs');
    expect(pkg?.size).toBeGreaterThan(0);
  });

  it('runs analyzeDirectory and returns structured diagnostics with pass status for healthy fixture', () => {
    const fixtureDir = path.resolve(process.cwd(), 'fixtures/healthy-nextjs');
    const report = analyzeDirectory(fixtureDir);

    expect(report.status).toBe('pass');
    expect(report.filesInspected.length).toBeGreaterThan(0);
    expect(report.diagnostics[0]?.code).toBe('OK_PROJECT_HEALTHY');
  });

  it('detects missing build script in fixture directory', () => {
    const fixtureDir = path.resolve(process.cwd(), 'fixtures/missing-build-script');
    const report = analyzeDirectory(fixtureDir);

    expect(report.status).toBe('fail');
    expect(report.diagnostics.some(d => d.code === 'ERR_BUILD_SCRIPT_MISSING')).toBe(true);
  });
});
