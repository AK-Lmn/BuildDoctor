'use client';

import { useState, useRef, useCallback } from 'react';
import type { DiagnoseInput, Platform } from '@/lib/types';
import { LIMITS, PLATFORMS, ALLOWED_UPLOAD_EXTENSIONS } from '@/lib/config';

interface Props {
  onSubmit: (input: DiagnoseInput) => void;
  onRetry?: () => void;
  initialError?: string | null;
  isSubmitting?: boolean;
}

// ── Example cases ─────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label: 'Next.js module not found',
    repositoryUrl: 'https://github.com/vercel/next.js',
    platform: 'vercel' as Platform,
    buildLog: `info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/pages/api-reference/next.config/eslint\nerror - ./app/components/Header.tsx\nModule not found: Can't resolve '@/components/layout/Header'\nimport { Header } from '@/components/layout/Header'\n\nError: Module not found: Can't resolve '@/components/layout/Header'\n  > 1 | import { Header } from '@/components/layout/Header'\n    2 | \n\n./pages/_app.tsx\nExport encountered an error.`,
  },
  {
    label: 'npm peer dep conflict',
    repositoryUrl: '',
    platform: 'github-actions' as Platform,
    buildLog: `npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree\nnpm ERR! \nnpm ERR! While resolving: my-app@1.0.0\nnpm ERR! Found: react@18.2.0\nnpm ERR! node_modules/react\nnpm ERR!   react@"^18.2.0" from the root project\nnpm ERR! \nnpm ERR! Could not resolve dependency:\nnpm ERR! peer react@"^17.0.0" from some-library@2.0.0\nnpm ERR! node_modules/some-library\nnpm ERR!   some-library@"^2.0.0" from the root project\nnpm ERR! \nnpm ERR! Fix the upstream dependency conflict, or retry\nnpm ERR! this command with --force or --legacy-peer-deps`,
  },
  {
    label: 'TypeScript build failure',
    repositoryUrl: '',
    platform: 'vercel' as Platform,
    buildLog: `$ tsc --noEmit\nsrc/app/page.tsx(12,25): error TS2339: Property 'title' does not exist on type 'PageProps'\nsrc/app/page.tsx(18,5): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'\nsrc/components/Layout.tsx(7,10): error TS2305: Module '"../lib/types"' has no exported member 'LayoutProps'\nFound 3 errors in 2 files.\n\nError: Command "tsc --noEmit" exited with 1`,
  },
  {
    label: 'Vercel function timeout',
    repositoryUrl: '',
    platform: 'vercel' as Platform,
    buildLog: `[2024-01-15T10:23:45.123Z] Function invocation failed\nError: FUNCTION_INVOCATION_TIMEOUT\nTask timed out after 10.00 seconds\nat /var/task/.next/server/app/api/process/route.js:1:2341\n\nFunction: api/process\nDuration: 10000ms\nMax duration: 10000ms`,
  },
  {
    label: 'Missing environment variable',
    repositoryUrl: '',
    platform: 'netlify' as Platform,
    buildLog: `Build command: npm run build\n> next build\n\n TypeError: Cannot read properties of undefined (reading 'startsWith')\n    at processUrl (src/lib/api.ts:23:15)\n\nError: process.env.API_BASE_URL is undefined\nEnvironment variable API_BASE_URL is not set.\nMake sure to add it in your Netlify environment settings.\n\nFailed during stage 'building site': Build script returned non-zero exit code: 1`,
  },
  {
    label: 'Lockfile / package manager mismatch',
    repositoryUrl: '',
    platform: 'github-actions' as Platform,
    buildLog: `Run npm ci\nnpm warn config The --legacy-peer-deps flag was set.\nnpm error code EUSAGE\nnpm error \nnpm error \`npm ci\` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.\nnpm error Invalid: lock file's react@18.2.0 does not satisfy react@^17.0.0 from package.json\nnpm error \nnpm error Try making a new package-lock.json:\nnpm error   npm install\nnpm error \nnpm error A complete log of this run can be found in: /home/runner/.npm/_logs/2024-01-15T10_23_45_000Z-debug-0.log\nError: Process completed with exit code 1.`,
  },
];

// ── Input component helpers ───────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#16181c',
  border: '1px solid #2a2d35',
  borderRadius: '6px',
  padding: '10px 12px',
  color: '#e8eaf0',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#8b909e',
  marginBottom: '6px',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagnoseForm({ onSubmit, onRetry, initialError, isSubmitting }: Props) {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [gitRef, setGitRef] = useState('');
  const [platform, setPlatform] = useState<Platform>('local');
  const [buildLog, setBuildLog] = useState('');
  const [projectContext, setProjectContext] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!repositoryUrl && !buildLog) {
      errors.repositoryUrl = 'Provide a repository URL, a build log, or both.';
    }
    if (repositoryUrl && !repositoryUrl.startsWith('https://github.com/')) {
      errors.repositoryUrl = 'Must be a public GitHub repository URL (https://github.com/...)';
    }
    if (buildLog && buildLog.length > LIMITS.BUILD_LOG_MAX_CHARS) {
      errors.buildLog = `Build log exceeds ${(LIMITS.BUILD_LOG_MAX_CHARS / 1000).toFixed(0)}K character limit`;
    }
    if (gitRef && gitRef.length > LIMITS.GIT_REF_MAX_CHARS) {
      errors.gitRef = `Git ref exceeds ${LIMITS.GIT_REF_MAX_CHARS} character limit`;
    }
    return errors;
  }, [repositoryUrl, buildLog, gitRef]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      repositoryUrl: repositoryUrl || undefined,
      gitRef: gitRef || undefined,
      buildLog: buildLog || undefined,
      projectContext: projectContext || undefined,
      platform,
    });
  }, [validate, onSubmit, repositoryUrl, gitRef, buildLog, projectContext, platform]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    // Validate type
    const ext = '.' + (file.name.split('.').pop() ?? '');
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext as '.txt' | '.log')) {
      setUploadError(`Unsupported file type "${ext}". Only .txt and .log files are allowed.`);
      return;
    }

    // Validate size
    if (file.size > LIMITS.UPLOAD_MAX_BYTES) {
      setUploadError(`File too large (${(file.size / 1024).toFixed(0)} KB). Maximum is ${(LIMITS.UPLOAD_MAX_BYTES / 1024).toFixed(0)} KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        setBuildLog(text.slice(0, LIMITS.BUILD_LOG_MAX_CHARS));
      }
    };
    reader.readAsText(file, 'utf-8');
  }, []);

  const loadExample = useCallback((ex: typeof EXAMPLES[0]) => {
    setRepositoryUrl(ex.repositoryUrl);
    setPlatform(ex.platform);
    setBuildLog(ex.buildLog);
    setGitRef('');
    setProjectContext('');
    setValidationErrors({});
    setUploadError('');
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div style={{ marginBottom: '32px', paddingTop: '8px' }}>
        <h1 style={{
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 800,
          color: '#f59e0b',
          letterSpacing: '-0.03em',
          margin: '0 0 8px 0',
          lineHeight: 1.2,
        }}>
          Turn build failures into a fix plan.
        </h1>
        <p style={{ color: '#8b909e', fontSize: '15px', margin: 0, maxWidth: '560px' }}>
          Provide a public GitHub repository and/or build log. BuildDoctor analyzes configuration files, detects error patterns, and produces an evidence-backed repair plan.
        </p>
      </div>

      {/* Error banner */}
      {initialError && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#f87171',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <span aria-hidden>⚠</span>
          <div style={{ flex: 1 }}>
            <strong>Diagnosis failed:</strong> {initialError}
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '4px',
                color: '#f87171',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate aria-label="Build failure diagnosis form">
        <div style={{
          background: '#16181c',
          border: '1px solid #2a2d35',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* Repository URL */}
          <div>
            <label htmlFor="repo-url" style={labelStyle}>
              Repository URL
              <span style={{ color: '#555a68', fontWeight: 400, marginLeft: '6px' }}>— public GitHub only</span>
            </label>
            <input
              id="repo-url"
              type="url"
              value={repositoryUrl}
              onChange={e => setRepositoryUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              maxLength={LIMITS.REPO_URL_MAX_CHARS}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="repo-url-desc repo-url-error"
              aria-invalid={!!validationErrors.repositoryUrl}
              style={{
                ...inputStyle,
                borderColor: validationErrors.repositoryUrl ? '#f87171' : '#2a2d35',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
              onBlur={e => { e.currentTarget.style.borderColor = validationErrors.repositoryUrl ? '#f87171' : '#2a2d35'; }}
            />
            <p id="repo-url-desc" style={{ fontSize: '12px', color: '#555a68', margin: '4px 0 0 0' }}>
              Only public repositories are supported. No private repos or GitHub Enterprise.
            </p>
            {validationErrors.repositoryUrl && (
              <p id="repo-url-error" role="alert" style={{ fontSize: '12px', color: '#f87171', margin: '4px 0 0 0' }}>
                {validationErrors.repositoryUrl}
              </p>
            )}
          </div>

          {/* Git Ref */}
          <div>
            <label htmlFor="git-ref" style={labelStyle}>
              Branch / Tag / Commit
              <span style={{ color: '#555a68', fontWeight: 400, marginLeft: '6px' }}>— optional, defaults to main branch</span>
            </label>
            <input
              id="git-ref"
              type="text"
              value={gitRef}
              onChange={e => setGitRef(e.target.value)}
              placeholder="main, v1.2.0, abc1234..."
              maxLength={LIMITS.GIT_REF_MAX_CHARS}
              spellCheck={false}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#2a2d35'; }}
            />
          </div>

          {/* Platform */}
          <div>
            <label htmlFor="platform" style={labelStyle}>
              Deployment Platform <span style={{ color: '#f87171' }} aria-hidden>*</span>
            </label>
            <select
              id="platform"
              value={platform}
              onChange={e => setPlatform(e.target.value as Platform)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238b909e' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px',
              }}
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Build Log */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
              <label htmlFor="build-log" style={{ ...labelStyle, marginBottom: 0 }}>
                Build Log
                <span style={{ color: '#555a68', fontWeight: 400, marginLeft: '6px' }}>— paste output or upload file</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {buildLog && (
                  <span style={{ fontSize: '11px', color: '#555a68' }}>
                    {buildLog.length.toLocaleString()} / {LIMITS.BUILD_LOG_MAX_CHARS.toLocaleString()} chars
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: '12px',
                    color: '#f59e0b',
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Upload .txt / .log
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.log"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  aria-label="Upload build log file"
                />
              </div>
            </div>
            <textarea
              id="build-log"
              value={buildLog}
              onChange={e => setBuildLog(e.target.value)}
              placeholder="Paste your build or deployment log here..."
              rows={10}
              maxLength={LIMITS.BUILD_LOG_MAX_CHARS}
              spellCheck={false}
              aria-describedby="build-log-desc build-log-error"
              aria-invalid={!!validationErrors.buildLog}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: '13px',
                lineHeight: 1.5,
                minHeight: '180px',
                borderColor: validationErrors.buildLog ? '#f87171' : '#2a2d35',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
              onBlur={e => { e.currentTarget.style.borderColor = validationErrors.buildLog ? '#f87171' : '#2a2d35'; }}
            />
            {uploadError && (
              <p role="alert" style={{ fontSize: '12px', color: '#f87171', margin: '4px 0 0 0' }}>
                {uploadError}
              </p>
            )}
            {validationErrors.buildLog && (
              <p id="build-log-error" role="alert" style={{ fontSize: '12px', color: '#f87171', margin: '4px 0 0 0' }}>
                {validationErrors.buildLog}
              </p>
            )}
            <p id="build-log-desc" style={{ fontSize: '12px', color: '#555a68', margin: '4px 0 0 0' }}>
              Remove sensitive credentials before submitting. Automatic redaction reduces risk but is not guaranteed.
            </p>
          </div>

          {/* Project Context */}
          <div>
            <label htmlFor="project-context" style={labelStyle}>
              Project Context
              <span style={{ color: '#555a68', fontWeight: 400, marginLeft: '6px' }}>— optional additional context</span>
            </label>
            <textarea
              id="project-context"
              value={projectContext}
              onChange={e => setProjectContext(e.target.value)}
              placeholder="Any additional context: recent changes, previous working state, steps tried..."
              rows={3}
              maxLength={LIMITS.PROJECT_CONTEXT_MAX_CHARS}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '80px',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#f59e0b'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#2a2d35'; }}
            />
          </div>
        </div>

        {/* Examples */}
        <div style={{ margin: '20px 0' }}>
          <p style={{ fontSize: '13px', color: '#8b909e', marginBottom: '8px' }}>Quick examples:</p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => loadExample(ex)}
                style={{
                  fontSize: '12px',
                  color: '#22d3ee',
                  background: 'rgba(34,211,238,0.06)',
                  border: '1px solid rgba(34,211,238,0.2)',
                  borderRadius: '4px',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy note */}
        <div style={{
          background: 'rgba(245,158,11,0.04)',
          border: '1px solid rgba(245,158,11,0.15)',
          borderRadius: '6px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '12px',
          color: '#8b909e',
        }}>
          <strong style={{ color: '#f59e0b' }}>Privacy & Safety:</strong>{' '}
          BuildDoctor fetches selected text files from public repositories. Logs are processed server-side and may be sent to Gemini (redacted). No code is executed. Patches are advisory only. Do not submit private credentials or sensitive source code.
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: isSubmitting ? '#92400e' : '#f59e0b',
            color: '#0f0f11',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
            transition: 'background 150ms, transform 80ms',
            opacity: isSubmitting ? 0.7 : 1,
          }}
          onMouseDown={e => { if (!isSubmitting) e.currentTarget.style.transform = 'scale(0.99)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {isSubmitting ? 'Analyzing...' : '⚡ Analyze Failure'}
        </button>
      </form>
    </div>
  );
}
