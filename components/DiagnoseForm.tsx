'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  FileCode,
  Upload,
  Play,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
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
  background: '#06070a',
  border: '1.5px solid rgba(157, 123, 255, 0.16)',
  borderRadius: '10px',
  padding: '12px 14px',
  color: '#ffffff',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms, box-shadow 150ms',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#ffffff',
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Hero */}
      <div style={{ marginBottom: '32px', paddingTop: '8px' }}>
        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 38px)',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.03em',
          margin: '0 0 10px 0',
          lineHeight: 1.2,
        }}>
          Turn build failures into a <span style={{ color: '#9d7bff' }}>fix plan</span>.
        </h1>
        <p style={{ color: '#a4a7bd', fontSize: '15px', margin: 0, maxWidth: '640px', lineHeight: 1.6 }}>
          Add a public GitHub repo or paste a build log to find where it failed and get a fix.
        </p>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {initialError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            aria-live="assertive"
            style={{
              background: 'rgba(255,107,129,0.1)',
              border: '1px solid rgba(255,107,129,0.3)',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '20px',
              color: '#ff6b81',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, color: '#ff6b81' }} />
            <div style={{ flex: 1 }}>
              <strong>Diagnosis failed:</strong> {initialError}
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  background: 'rgba(255,107,129,0.15)',
                  border: '1px solid rgba(255,107,129,0.3)',
                  borderRadius: '6px',
                  color: '#ff6b81',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcw size={13} />
                <span>Retry</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate aria-label="Build failure diagnosis form">
        <div style={{
          background: '#101118',
          border: '1px solid rgba(157, 123, 255, 0.16)',
          borderRadius: '16px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
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
                borderColor: validationErrors.repositoryUrl ? '#ff6b81' : 'rgba(157, 123, 255, 0.16)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#9d7bff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(157, 123, 255, 0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = validationErrors.repositoryUrl ? '#ff6b81' : 'rgba(157, 123, 255, 0.16)';
                e.currentTarget.style.boxShadow = 'none';
              }}
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
              Branch, Tag, or Commit
              <span style={{ color: '#a4a7bd', fontWeight: 400, marginLeft: '6px' }}>— optional</span>
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
              onFocus={e => {
                e.currentTarget.style.borderColor = '#9d7bff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(157, 123, 255, 0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(157, 123, 255, 0.16)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Platform */}
          <div>
            <label htmlFor="platform" style={labelStyle}>
              Deployment Platform <span style={{ color: '#ff6b81' }} aria-hidden>*</span>
            </label>
            <select
              id="platform"
              value={platform}
              onChange={e => setPlatform(e.target.value as Platform)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%239d7bff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                paddingRight: '40px',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#9d7bff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(157, 123, 255, 0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(157, 123, 255, 0.16)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value} style={{ background: '#101118', color: '#ffffff' }}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Build Log */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <label htmlFor="build-log" style={{ ...labelStyle, marginBottom: 0 }}>
                Build Log
                <span style={{ color: '#a4a7bd', fontWeight: 400, marginLeft: '6px' }}>— paste output or upload file</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {buildLog && (
                  <span style={{ fontSize: '11px', color: '#a4a7bd', fontFamily: 'ui-monospace, Consolas, monospace' }}>
                    {buildLog.length.toLocaleString()} / {LIMITS.BUILD_LOG_MAX_CHARS.toLocaleString()} chars
                  </span>
                )}
                <button
                  type="button"
                  aria-controls="log-file-input"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#9d7bff',
                    background: 'rgba(157, 123, 255, 0.1)',
                    border: '1px solid #433878',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    minHeight: '36px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(157, 123, 255, 0.2)';
                    e.currentTarget.style.borderColor = '#9d7bff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(157, 123, 255, 0.1)';
                    e.currentTarget.style.borderColor = '#433878';
                  }}
                >
                  <Upload size={14} />
                  <span>Upload log</span>
                </button>
                <input
                  id="log-file-input"
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
              placeholder="Paste build output or error log..."
              maxLength={LIMITS.BUILD_LOG_MAX_CHARS}
              rows={8}
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
                borderColor: validationErrors.buildLog ? '#ff6b81' : 'rgba(157, 123, 255, 0.16)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#9d7bff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(157, 123, 255, 0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = validationErrors.buildLog ? '#ff6b81' : 'rgba(157, 123, 255, 0.16)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            {uploadError && (
              <p role="alert" style={{ fontSize: '12px', color: '#ff6b81', margin: '4px 0 0 0' }}>
                {uploadError}
              </p>
            )}
            {validationErrors.buildLog && (
              <p id="build-log-error" role="alert" style={{ fontSize: '12px', color: '#ff6b81', margin: '4px 0 0 0' }}>
                {validationErrors.buildLog}
              </p>
            )}
            <p id="build-log-desc" style={{ fontSize: '12px', color: '#6b6e82', margin: '6px 0 0 0' }}>
              Remove sensitive credentials before submitting. Automatic redaction reduces risk but is not guaranteed.
            </p>
          </div>

          {/* Project Context */}
          <div>
            <label htmlFor="project-context" style={labelStyle}>
              Project Context
              <span style={{ color: '#a4a7bd', fontWeight: 400, marginLeft: '6px' }}>— optional additional context</span>
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
              onFocus={e => {
                e.currentTarget.style.borderColor = '#9d7bff';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(157, 123, 255, 0.2)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(157, 123, 255, 0.16)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Integrated Workbench Toolbar & Actions (Unslopped) */}
          <div style={{
            borderTop: '1px solid rgba(157, 123, 255, 0.14)',
            paddingTop: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a4a7bd', fontSize: '12px' }}>
              <Info size={15} style={{ color: '#9d7bff', flexShrink: 0 }} />
              <span>Static analysis only. No code is executed.</span>
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              style={{
                padding: '12px 28px',
                background: isSubmitting ? '#584496' : '#9d7bff',
                color: '#0d091a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: '0 4px 16px rgba(157, 123, 255, 0.3)',
                transition: 'background 150ms, box-shadow 150ms',
                opacity: isSubmitting ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginLeft: 'auto',
              }}
            >
              <Play size={15} fill="currentColor" />
              <span>{isSubmitting ? 'Analyzing...' : 'Diagnose'}</span>
            </motion.button>
          </div>
        </div>

        {/* Preset Failure Modes (Docked directly under card) */}
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#a4a7bd', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Examples:
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {EXAMPLES.map((ex, i) => (
              <motion.button
                key={i}
                type="button"
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => loadExample(ex)}
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#9d7bff',
                  background: 'rgba(157, 123, 255, 0.08)',
                  border: '1px solid #433878',
                  borderRadius: '9999px',
                  padding: '5px 13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(157, 123, 255, 0.2)';
                  e.currentTarget.style.borderColor = '#9d7bff';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(157, 123, 255, 0.08)';
                  e.currentTarget.style.borderColor = '#433878';
                  e.currentTarget.style.color = '#9d7bff';
                }}
              >
                {ex.label}
              </motion.button>
            ))}
          </div>
        </div>
      </form>
    </motion.div>
  );
}
