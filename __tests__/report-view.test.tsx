import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReportView from '@/components/ReportView';
import type { DiagnoseResponse } from '@/lib/types';

const result = {
  report: {
    status: 'insufficient-evidence',
    primaryDiagnosis: { title: 'Unknown', category: 'UNKNOWN', severity: 'low', confidence: 'low', summary: 'None', whyItFails: 'None' },
    evidence: [], contributingFactors: [], repairPlan: [], suggestedPatches: [], verificationCommands: [], unresolvedQuestions: [], limitations: [], usedAI: false,
  },
  deterministicFindings: [],
  filesInspected: Array.from({ length: 12 }, (_, index) => `src/file-${index}.ts`),
  aiUsed: false,
  processingMs: 1,
} as DiagnoseResponse;

describe('ReportView inspected files', () => {
  it('initially displays only the ten most relevant inspected files', () => {
    render(<ReportView input={{ repositoryUrl: 'https://github.com/acme/repo', platform: 'local' }} result={result} onNewDiagnosis={() => {}} onAnalyzeAgain={() => {}} />);
    expect(screen.getByText('src/file-9.ts')).toBeInTheDocument();
    expect(screen.queryByText('src/file-10.ts')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all inspected files' })).toHaveAttribute('aria-expanded', 'false');
  });
});
