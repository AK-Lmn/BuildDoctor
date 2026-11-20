'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Clock, GitBranch, ShieldCheck } from 'lucide-react';
import BuildDoctorMark from './BuildDoctorMark';

interface Props {
  stages: readonly string[];
  currentStage: number;
  elapsedMs: number;
  repositoryUrl?: string;
  platform?: string;
  hasGithubAuth: boolean;
  onCancel: () => void;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function LoadingState({
  stages,
  currentStage,
  elapsedMs,
  repositoryUrl,
  platform,
  hasGithubAuth,
  onCancel,
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Analyzing build failure"
      className="animate-fade-in"
      style={{
        maxWidth: '560px',
        margin: '48px auto',
        textAlign: 'center',
      }}
    >
      {/* Animated mark */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <BuildDoctorMark size={64} isAnalyzing={true} />
        </div>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#ffffff',
          margin: '0 0 8px 0',
          letterSpacing: '-0.02em',
        }}>
          Diagnosing build failure
        </h2>
        <motion.p
          key={stages[currentStage]}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{ color: '#a4a7bd', fontSize: '14px', margin: 0 }}
        >
          {stages[currentStage] ?? 'Processing...'}
        </motion.p>
      </div>

      {/* Stages card with subtle scanning light */}
      <div style={{
        background: '#101118',
        border: '1px solid rgba(157, 123, 255, 0.2)',
        borderRadius: '16px',
        padding: '20px',
        textAlign: 'left',
        marginBottom: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated radar scan line across the card */}
        <div className="radar-scan-overlay" />
        {stages.map((stage, i) => {
          const isDone = i < currentStage;
          const isCurrent = i === currentStage;
          const isPending = i > currentStage;

          return (
            <motion.div
              key={stage}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 0',
                color: isDone ? '#55e6a5' : isCurrent ? '#9d7bff' : '#6b6e82',
                fontSize: '13px',
                fontFamily: 'ui-monospace, Consolas, monospace',
                transition: 'color 200ms ease',
              }}
            >
              <span style={{ width: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isDone ? (
                  <CheckCircle2 size={16} style={{ color: '#55e6a5' }} />
                ) : isCurrent ? (
                  <Loader2 size={16} className="animate-spin-fast" style={{ color: '#9d7bff' }} />
                ) : (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6b6e82' }} />
                )}
              </span>
              <span
                style={{
                  fontWeight: isCurrent ? 600 : 400,
                  opacity: isPending ? 0.45 : 1,
                  color: isCurrent ? '#ffffff' : undefined,
                  transition: 'all 200ms ease',
                }}
              >
                {stage}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Metadata */}
      <div style={{
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: '24px',
        fontSize: '12px',
        fontFamily: 'ui-monospace, Consolas, monospace',
      }}>
        {repositoryUrl && (
          <span style={{
            background: 'rgba(157, 123, 255, 0.08)',
            border: '1px solid #433878',
            borderRadius: '9999px',
            padding: '4px 12px',
            color: '#9d7bff',
            maxWidth: '220px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <GitBranch size={13} />
            <span>{repositoryUrl.replace('https://github.com/', '')}</span>
          </span>
        )}
        {platform && (
          <span style={{
            background: '#101118',
            border: '1px solid rgba(157, 123, 255, 0.16)',
            borderRadius: '9999px',
            padding: '4px 12px',
            color: '#a4a7bd',
          }}>
            {platform}
          </span>
        )}
        <span style={{
          background: '#101118',
          border: '1px solid rgba(157, 123, 255, 0.16)',
          borderRadius: '9999px',
          padding: '4px 12px',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <Clock size={13} style={{ color: '#9d7bff' }} />
          <span>{formatElapsed(elapsedMs)}</span>
        </span>
        <span style={{
          background: '#101118',
          border: '1px solid rgba(157, 123, 255, 0.16)',
          borderRadius: '9999px',
          padding: '4px 12px',
          color: hasGithubAuth ? '#55e6a5' : '#a4a7bd',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <ShieldCheck size={13} style={{ color: hasGithubAuth ? '#55e6a5' : '#a4a7bd' }} />
          <span>GitHub: {hasGithubAuth ? 'authenticated' : 'public rate limit'}</span>
        </span>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        aria-label="Cancel analysis"
        style={{
          padding: '8px 24px',
          background: 'transparent',
          border: '1px solid rgba(157, 123, 255, 0.2)',
          borderRadius: '9999px',
          color: '#a4a7bd',
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff6b81'; e.currentTarget.style.color = '#ff6b81'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(157, 123, 255, 0.2)'; e.currentTarget.style.color = '#a4a7bd'; }}
      >
        Cancel
      </button>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
