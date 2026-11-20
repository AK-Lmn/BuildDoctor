'use client';

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
        <div
          className="animate-spin-fast"
          style={{
            width: '48px',
            height: '48px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            border: '2px solid #f59e0b',
            borderTopColor: 'transparent',
          }}
        />
        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#e8eaf0',
          margin: '0 0 8px 0',
        }}>
          Diagnosing build failure
        </h2>
        <p style={{ color: '#8b909e', fontSize: '14px', margin: 0 }}>
          {stages[currentStage] ?? 'Processing...'}
        </p>
      </div>

      {/* Stages */}
      <div style={{
        background: '#16181c',
        border: '1px solid #2a2d35',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'left',
        marginBottom: '24px',
      }}>
        {stages.map((stage, i) => {
          const isDone = i < currentStage;
          const isCurrent = i === currentStage;
          const isPending = i > currentStage;

          return (
            <div
              key={stage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
                color: isDone ? '#34d399' : isCurrent ? '#f59e0b' : '#555a68',
                fontSize: '13px',
              }}
            >
              <span style={{ width: '16px', textAlign: 'center', flexShrink: 0 }}>
                {isDone ? '✓' : isCurrent ? '…' : '○'}
              </span>
              <span
                style={{
                  fontWeight: isCurrent ? 600 : 400,
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                {stage}
              </span>
            </div>
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
      }}>
        {repositoryUrl && (
          <span style={{
            background: '#1e2028',
            border: '1px solid #2a2d35',
            borderRadius: '4px',
            padding: '3px 8px',
            color: '#8b909e',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {repositoryUrl.replace('https://github.com/', '')}
          </span>
        )}
        {platform && (
          <span style={{
            background: '#1e2028',
            border: '1px solid #2a2d35',
            borderRadius: '4px',
            padding: '3px 8px',
            color: '#8b909e',
          }}>
            {platform}
          </span>
        )}
        <span style={{
          background: '#1e2028',
          border: '1px solid #2a2d35',
          borderRadius: '4px',
          padding: '3px 8px',
          color: '#22d3ee',
        }}>
          {formatElapsed(elapsedMs)}
        </span>
        <span style={{
          background: '#1e2028',
          border: '1px solid #2a2d35',
          borderRadius: '4px',
          padding: '3px 8px',
          color: hasGithubAuth ? '#34d399' : '#8b909e',
        }}>
          GitHub: {hasGithubAuth ? 'authenticated' : 'public rate limit'}
        </span>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        aria-label="Cancel analysis"
        style={{
          padding: '8px 20px',
          background: 'transparent',
          border: '1px solid #2a2d35',
          borderRadius: '6px',
          color: '#8b909e',
          fontSize: '13px',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#f87171'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2d35'; e.currentTarget.style.color = '#8b909e'; }}
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
