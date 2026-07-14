import { describe, it, expect } from 'vitest';
import { buildDeterministicReport } from '@/lib/gemini';
import { DiagnosisReport } from '@/lib/types';
import { generateMarkdownReport } from '@/lib/export';
import type { DiagnoseResponse, DiagnoseInput, DeterministicFinding } from '@/lib/types';

function makeFinding(overrides: Partial<DeterministicFinding> = {}): DeterministicFinding {
  return {
    id: 'det-1',
    category: 'MODULE_NOT_FOUND',
    severity: 'critical',
    confidence: 'high',
    title: 'Module not found',
    summary: 'A module could not be resolved',
    evidence: [
      {
        id: 'ev-1',
        source: 'build-log',
        excerpt: "Can't resolve '@/components/Header'",
        explanation: 'Import failed',
        lineStart: 5,
        lineEnd: 5,
      },
    ],
    recommendedAction: 'Check import path',
    ...overrides,
  };
}

describe('buildDeterministicReport', () => {
  it('returns insufficient-evidence when no findings', () => {
    const report = buildDeterministicReport([]);
    expect(report.status).toBe('insufficient-evidence');
    expect(report.primaryDiagnosis.category).toBe('UNKNOWN');
    expect(report.usedAI).toBe(false);
  });

  it('uses primary finding as primary diagnosis', () => {
    const finding = makeFinding({ title: 'Critical module error', category: 'MODULE_NOT_FOUND' });
    const report = buildDeterministicReport([finding]);
    expect(report.primaryDiagnosis.title).toBe('Critical module error');
    expect(report.primaryDiagnosis.category).toBe('MODULE_NOT_FOUND');
  });

  it('marks AI as not used', () => {
    const report = buildDeterministicReport([makeFinding()]);
    expect(report.usedAI).toBe(false);
  });

  it('computes severity counts', () => {
    const findings = [
      makeFinding({ severity: 'critical' }),
      makeFinding({ id: 'det-2', severity: 'high' }),
    ];
    const report = buildDeterministicReport(findings);
    expect(report.severityCounts?.critical).toBeGreaterThanOrEqual(1);
  });

  it('populates contributing factors from secondary findings', () => {
    const findings = [
      makeFinding({ id: '1', title: 'Primary' }),
      makeFinding({ id: '2', title: 'Secondary', category: 'TYPESCRIPT_ERROR', severity: 'high' }),
    ];
    const report = buildDeterministicReport(findings);
    expect(report.contributingFactors.length).toBeGreaterThan(0);
    expect(report.contributingFactors[0].title).toBe('Secondary');
  });

  it('validates against DiagnosisReport schema', () => {
    const report = buildDeterministicReport([makeFinding()]);
    expect(() => DiagnosisReport.parse(report)).not.toThrow();
  });
});

describe('DiagnosisReport schema', () => {
  it('accepts valid report', () => {
    const report = {
      status: 'diagnosed',
      primaryDiagnosis: {
        title: 'Test',
        category: 'MODULE_NOT_FOUND',
        severity: 'critical',
        confidence: 'high',
        summary: 'Test summary',
        whyItFails: 'Because reasons',
      },
      evidence: [],
      contributingFactors: [],
      repairPlan: [],
      suggestedPatches: [],
      verificationCommands: [],
      unresolvedQuestions: [],
      limitations: [],
      usedAI: false,
    };
    expect(() => DiagnosisReport.parse(report)).not.toThrow();
  });

  it('rejects invalid severity', () => {
    const report = {
      status: 'diagnosed',
      primaryDiagnosis: {
        title: 'Test',
        category: 'MODULE_NOT_FOUND',
        severity: 'ultra-critical', // invalid
        confidence: 'high',
        summary: 'Test',
        whyItFails: 'Test',
      },
      evidence: [],
      contributingFactors: [],
      repairPlan: [],
      suggestedPatches: [],
      verificationCommands: [],
      unresolvedQuestions: [],
      limitations: [],
      usedAI: false,
    };
    expect(() => DiagnosisReport.parse(report)).toThrow();
  });
});

describe('generateMarkdownReport', () => {
  const mockInput: DiagnoseInput = {
    repositoryUrl: 'https://github.com/test/repo',
    platform: 'vercel',
    buildLog: 'Error: module not found',
  };

  const mockResult: DiagnoseResponse = {
    report: buildDeterministicReport([makeFinding()]),
    deterministicFindings: [makeFinding()],
    filesInspected: ['package.json', 'next.config.ts'],
    aiUsed: false,
    aiSynthesisState: 'not-configured',
    processingMs: 1234,
  };

  it('generates markdown with title', () => {
    const md = generateMarkdownReport(mockInput, mockResult);
    expect(md).toContain('# BuildDoctor Diagnosis Report');
  });

  it('includes repository URL', () => {
    const md = generateMarkdownReport(mockInput, mockResult);
    expect(md).toContain('https://github.com/test/repo');
  });

  it('includes disclaimer', () => {
    const md = generateMarkdownReport(mockInput, mockResult);
    expect(md).toContain('BuildDoctor is a diagnostic assistant');
  });

  it('includes files inspected', () => {
    const md = generateMarkdownReport(mockInput, mockResult);
    expect(md).toContain('package.json');
    expect(md).toContain('next.config.ts');
  });

  it('does not contain actual API key values', () => {
    const md = generateMarkdownReport(mockInput, mockResult);
    // The markdown may reference key names as advice, but must not contain actual key values
    expect(md).not.toMatch(/GEMINI_API_KEY\s*=\s*\S+/);
    expect(md).not.toMatch(/GITHUB_TOKEN\s*=\s*\S+/);
    // Should not contain placeholder example values either
    expect(md).not.toContain('your_gemini_api_key');
    expect(md).not.toContain('ghp_');
  });

  it('marks AI as not used when deterministic only', () => {
    const md = generateMarkdownReport(mockInput, mockResult);
    expect(md).toContain('No');
  });
});
