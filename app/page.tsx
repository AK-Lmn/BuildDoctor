'use client';

import { useState, useRef, useCallback } from 'react';
import BuildDoctorMark from '@/components/BuildDoctorMark';
import DiagnoseForm from '@/components/DiagnoseForm';
import LoadingState from '@/components/LoadingState';
import ReportView from '@/components/ReportView';
import type { DiagnoseResponse, ApiError, AppPhase } from '@/lib/types';
import type { DiagnoseInput } from '@/lib/types';

const LOADING_STAGES = [
  'Validating input',
  'Reading repository metadata',
  'Selecting diagnostic files',
  'Normalizing build logs',
  'Running deterministic checks',
  'Preparing AI diagnosis',
  'Validating evidence',
  'Building repair plan',
] as const;

export default function HomePage() {
  const [phase, setPhase] = useState<AppPhase>('editing');
  const [lastInput, setLastInput] = useState<DiagnoseInput | null>(null);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleSubmit = useCallback(async (input: DiagnoseInput) => {
    // Prevent duplicate submissions
    if (phase === 'validating' || phase === 'fetching-repository' || phase === 'analyzing') return;

    setLastInput(input);
    setResult(null);
    setError(null);
    setPhase('validating');
    setLoadingStage(0);
    setElapsedMs(0);
    startTimer();

    abortRef.current = new AbortController();
    let stageInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // Simulate stage progression
      stageInterval = setInterval(() => {
        setLoadingStage(prev => {
          if (prev < LOADING_STAGES.length - 1) return prev + 1;
          return prev;
        });
      }, 2500);

      if (input.repositoryUrl) {
        setPhase('fetching-repository');
      } else {
        setPhase('analyzing');
      }

      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: abortRef.current.signal,
      });

      const data = await response.json() as DiagnoseResponse | { error: ApiError; githubRateLimit?: DiagnoseResponse['githubRateLimit'] };

      if (!response.ok) {
        const errData = data as { error: ApiError };
        setError(errData.error?.message ?? 'An unexpected error occurred');
        setPhase('error');
        return;
      }

      const resultData = data as DiagnoseResponse;
      setResult(resultData);
      setPhase('report');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPhase('editing');
        return;
      }
      setError((err as Error).message ?? 'Network error. Please try again.');
      setPhase('error');
    } finally {
      if (stageInterval) {
        clearInterval(stageInterval);
      }
      stopTimer();
    }
  }, [phase, startTimer, stopTimer]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    stopTimer();
    setPhase('editing');
  }, [stopTimer]);

  const handleRetry = useCallback(() => {
    if (lastInput) {
      handleSubmit(lastInput);
    }
  }, [lastInput, handleSubmit]);

  const handleNewDiagnosis = useCallback(() => {
    abortRef.current?.abort();
    stopTimer();
    setPhase('editing');
    setResult(null);
    setError(null);
    setLastInput(null);
    setLoadingStage(0);
    setElapsedMs(0);
  }, [stopTimer]);

  const isLoading = phase === 'validating' || phase === 'fetching-repository' || phase === 'analyzing';

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f11' }}>
      {/* Skip navigation */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
        onFocus={e => {
          const el = e.currentTarget;
          el.style.left = '8px';
          el.style.top = '8px';
          el.style.width = 'auto';
          el.style.height = 'auto';
        }}
        onBlur={e => {
          const el = e.currentTarget;
          el.style.left = '-9999px';
          el.style.width = '1px';
          el.style.height = '1px';
        }}
      >
        Skip to main content
      </a>

      {/* Header */}
      <header
        role="banner"
        style={{
          borderBottom: '1px solid #2a2d35',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: '#16181c',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <BuildDoctorMark size={32} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#f59e0b',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              fontFamily: 'ui-monospace, Consolas, monospace',
            }}>
              BuildDoctor
            </span>
            <span style={{ fontSize: '12px', color: '#8b909e', lineHeight: 1.3 }}>
              Build failure diagnostics
            </span>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px',
            color: '#34d399',
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: '4px',
            padding: '3px 8px',
            whiteSpace: 'nowrap',
          }}>
            ⚡ Static analysis — no code execution
          </span>
        </div>
      </header>

      {/* Main content */}
      <main id="main-content" role="main" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px', width: '100%', boxSizing: 'border-box' }}>
        {isLoading ? (
          <LoadingState
            stages={LOADING_STAGES}
            currentStage={loadingStage}
            elapsedMs={elapsedMs}
            repositoryUrl={lastInput?.repositoryUrl}
            platform={lastInput?.platform}
            hasGithubAuth={false}
            onCancel={handleCancel}
          />
        ) : phase === 'report' && result ? (
          <ReportView
            input={lastInput!}
            result={result}
            onNewDiagnosis={handleNewDiagnosis}
            onAnalyzeAgain={handleRetry}
          />
        ) : (
          <DiagnoseForm
            onSubmit={handleSubmit}
            initialError={phase === 'error' ? error : null}
            onRetry={phase === 'error' ? handleRetry : undefined}
            isSubmitting={isLoading}
          />
        )}
      </main>

      {/* Footer */}
      <footer role="contentinfo" style={{
        borderTop: '1px solid #2a2d35',
        padding: '16px 24px',
        textAlign: 'center',
        color: '#555a68',
        fontSize: '12px',
        marginTop: '48px',
      }}>
        BuildDoctor — Diagnostic assistant only. No code is executed. Suggestions must be reviewed.
      </footer>
    </div>
  );
}
