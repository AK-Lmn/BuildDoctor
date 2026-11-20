'use client';

import { useState, useRef, useCallback } from 'react';
import { Star, Github } from 'lucide-react';
import BuildDoctorMark from '@/components/BuildDoctorMark';
import BuildDoctorWordmark from '@/components/BuildDoctorWordmark';
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
          borderBottom: '1px solid rgba(157, 123, 255, 0.12)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          flexWrap: 'wrap',
        }}
      >
        <BuildDoctorWordmark size="md" isAnalyzing={isLoading} />

        <a
          href="https://github.com/AK-Lmn/BuildDoctor"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#a4a7bd',
            textDecoration: 'none',
            background: 'rgba(157, 123, 255, 0.08)',
            border: '1px solid #433878',
            borderRadius: '8px',
            padding: '6px 12px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = '#9d7bff';
            e.currentTarget.style.background = 'rgba(157, 123, 255, 0.16)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#a4a7bd';
            e.currentTarget.style.borderColor = '#433878';
            e.currentTarget.style.background = 'rgba(157, 123, 255, 0.08)';
          }}
        >
          <Github size={14} />
          <span>Star on GitHub</span>
          <Star size={12} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
        </a>
      </header>

      {/* Main content */}
      <main id="main-content" role="main" style={{ maxWidth: '980px', margin: '0 auto', padding: '36px 20px', width: '100%', boxSizing: 'border-box' }}>
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
      <footer
        role="contentinfo"
        style={{
          borderTop: '1px solid rgba(157, 123, 255, 0.1)',
          padding: '24px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px 24px',
          color: '#6b6e82',
          fontSize: '12px',
          marginTop: '64px',
          background: '#000000',
        }}
      >
        <span>
          BuildDoctor · Built by{' '}
          <a
            href="https://github.com/AK-Lmn"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#a4a7bd', textDecoration: 'none', transition: 'color 0.15s ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9d7bff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a4a7bd')}
          >
            AK-Lmn
          </a>
        </span>
        <span>Static analysis only. No code executed.</span>
      </footer>
    </div>
  );
}
