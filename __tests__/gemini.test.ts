import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: mocks.generateContent }; } }));

import { runGeminiDiagnosis } from '@/lib/gemini';
import type { DiagnoseInput } from '@/lib/types';

const input: DiagnoseInput = { platform: 'local', buildLog: 'build failed' };
const valid = {
  status: 'diagnosed',
  primaryDiagnosis: { title: 'Missing module', category: 'MODULE_NOT_FOUND', severity: 'critical', confidence: 'high', summary: 'Missing module.', whyItFails: 'Add it.' },
  evidence: [], contributingFactors: [], repairPlan: [], suggestedPatches: [], verificationCommands: [], unresolvedQuestions: [], limitations: [],
};

describe('Gemini synthesis fallback states', () => {
  afterEach(() => { delete process.env.GEMINI_API_KEY; mocks.generateContent.mockReset(); });

  it('reports a missing key without claiming a provider failure', async () => {
    const result = await runGeminiDiagnosis(input, null, null, [], []);
    expect(result.state).toBe('not-configured');
    expect(result.report.limitations.join(' ')).toContain('GEMINI_API_KEY');
  });

  it('classifies provider non-2xx failures safely', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mocks.generateContent.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { status: 503 }));
    const result = await runGeminiDiagnosis(input, null, null, [], []);
    expect(result).toMatchObject({ state: 'provider-error', httpStatus: 503, usedAI: false });
    expect(JSON.stringify(result)).not.toContain('test-key');
  });

  it('classifies aborted requests as timeouts', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mocks.generateContent.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    expect((await runGeminiDiagnosis(input, null, null, [], [])).state).toBe('timeout');
  });

  it('classifies malformed JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mocks.generateContent.mockResolvedValueOnce({ text: '{broken' });
    const result = await runGeminiDiagnosis(input, null, null, [], []);
    expect(result).toMatchObject({ state: 'invalid-structured-output', parsingFailed: true });
  });

  it('attempts one repair then reports Zod validation failure', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mocks.generateContent.mockResolvedValueOnce({ text: JSON.stringify({ status: 'diagnosed' }) }).mockResolvedValueOnce({ text: JSON.stringify({ status: 'diagnosed' }) });
    const result = await runGeminiDiagnosis(input, null, null, [], []);
    expect(result).toMatchObject({ state: 'invalid-structured-output', repairAttempted: true });
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
  });

  it('keeps a valid AI diagnosis when an unsupported evidence field is present', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mocks.generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...valid, evidence: [{ source: 'repository', file: 'invented.ts', excerpt: 'x', explanation: 'x' }] }) });
    expect((await runGeminiDiagnosis(input, null, null, [], [])).state).toBe('used');
  });

  it('returns a successful structured diagnosis', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    mocks.generateContent.mockResolvedValueOnce({ text: JSON.stringify(valid) });
    expect(await runGeminiDiagnosis(input, null, null, [], [])).toMatchObject({ state: 'used', usedAI: true });
  });
});
