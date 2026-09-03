import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  analyzeDirectory,
  analyzeProject,
  CATEGORY_TO_CODE,
  findingToDiagnostic,
  readDirectoryAsFiles,
} from '@/lib/analyzer';
import type { DeterministicFinding } from '@/lib/types';

const FIXTURES_DIR = path.resolve(process.cwd(), 'fixtures');

describe('Modular Analyzer: Fixture-based Deterministic Test Suite', () => {
  it('detects missing build script in fixture project', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'missing-build-script');
    const result = analyzeDirectory(fixturePath);

    expect(result.status).toBe('fail');
    const missingBuild = result.diagnostics.find(d => d.code === 'ERR_BUILD_SCRIPT_MISSING');
    expect(missingBuild).toBeDefined();
    expect(missingBuild?.status).toBe('fail');
    expect(missingBuild?.description).toContain('does not define a "build" script');
    expect(missingBuild?.remediation).toContain('Add a "build" script');
  });

  it('detects competing lockfiles in fixture project', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'lockfile-conflict');
    const result = analyzeDirectory(fixturePath);

    expect(result.status).toBe('fail');
    const lockfileConflict = result.diagnostics.find(d => d.code === 'ERR_LOCKFILE_CONFLICT');
    expect(lockfileConflict).toBeDefined();
    expect(lockfileConflict?.status).toBe('fail');
    expect(lockfileConflict?.remediation).toContain('Remove all lockfiles except');
  });

  it('detects package manager mismatch against lockfile in fixture project', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'package-manager-mismatch');
    const result = analyzeDirectory(fixturePath);

    expect(result.status).toBe('fail');
    const pmMismatch = result.diagnostics.find(d => d.code === 'ERR_PACKAGE_MANAGER_MISMATCH');
    expect(pmMismatch).toBeDefined();
    expect(pmMismatch?.description).toContain('pnpm');
    expect(pmMismatch?.remediation).toContain('pnpm install');
  });

  it('detects duplicate dependencies across dependencies and devDependencies', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'duplicate-dependencies');
    const result = analyzeDirectory(fixturePath);

    expect(['fail', 'warn']).toContain(result.status);
    const dupes = result.diagnostics.find(d => d.code === 'ERR_DEPS_MISMATCH');
    expect(dupes).toBeDefined();
    expect(dupes?.description).toContain('react');
  });

  it('detects invalid JSON in package.json', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'invalid-json-package');
    const result = analyzeDirectory(fixturePath);

    expect(result.status).toBe('fail');
    const invalidJson = result.diagnostics.find(d => d.code === 'ERR_INVALID_PACKAGE_JSON');
    expect(invalidJson).toBeDefined();
    expect(invalidJson?.status).toBe('fail');
    expect(invalidJson?.remediation).toContain('Validate package.json');
  });

  it('reports healthy pass state for compliant Next.js project', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'healthy-nextjs');
    const result = analyzeDirectory(fixturePath);

    expect(result.status).toBe('pass');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      status: 'pass',
      code: 'OK_PROJECT_HEALTHY',
    });
    expect(result.snapshot.framework).toBe('Next.js');
    expect(result.snapshot.typescriptUsage).toBe(true);
    expect(result.snapshot.buildCommand).toBe('next build');
  });

  it('identifies monorepo and workspaces without false positives', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'monorepo');
    const result = analyzeDirectory(fixturePath);

    expect(result.snapshot.isMonorepo).toBe(true);
    expect(result.snapshot.workspacePackages).toEqual(expect.arrayContaining(['web', 'ui']));
  });

  it('ignores nested test fixture package.json and honors root package.json build script', () => {
    const fixturePath = path.join(FIXTURES_DIR, 'nested-fixture-ignored');
    const result = analyzeDirectory(fixturePath);

    // Root project has "build": "next build", nested test fixture has {}
    // It should NOT emit ERR_BUILD_SCRIPT_MISSING!
    const missingBuild = result.diagnostics.find(d => d.code === 'ERR_BUILD_SCRIPT_MISSING');
    expect(missingBuild).toBeUndefined();
    expect(result.snapshot.buildCommand).toBe('next build');
  });

  it('is completely decoupled from console output and supports custom onLog handler', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const logs: string[] = [];
    const fixturePath = path.join(FIXTURES_DIR, 'healthy-nextjs');
    const files = readDirectoryAsFiles(fixturePath);

    const result = analyzeProject({
      files,
      onLog: (msg) => logs.push(msg),
    });

    expect(result.status).toBe('pass');
    expect(logs.length).toBeGreaterThan(0);
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('maps custom deterministic findings to structured diagnostics accurately', () => {
    const mockFinding: DeterministicFinding = {
      id: 'test-1',
      category: 'LOCKFILE_CONFLICT',
      severity: 'high',
      confidence: 'high',
      title: 'Conflicting lockfiles',
      summary: 'Found multiple conflicting lockfiles.',
      recommendedAction: 'Keep only one lockfile.',
      evidence: [
        {
          id: 'ev-1',
          source: 'repository',
          file: 'package-lock.json',
          excerpt: 'package-lock.json',
          explanation: 'Lockfile conflict detected.',
        },
      ],
    };

    const diag = findingToDiagnostic(mockFinding);
    expect(diag).toEqual({
      status: 'fail',
      code: CATEGORY_TO_CODE.LOCKFILE_CONFLICT,
      description: 'Found multiple conflicting lockfiles.',
      remediation: 'Keep only one lockfile.',
      category: 'LOCKFILE_CONFLICT',
      severity: 'high',
      file: 'package-lock.json',
      evidence: mockFinding.evidence,
    });
  });
});
