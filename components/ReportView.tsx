'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DiagnoseResponse, DiagnoseInput, ReportFilter } from '@/lib/types';
import { generateMarkdownReport } from '@/lib/export';

interface Props {
  input: DiagnoseInput;
  result: DiagnoseResponse;
  onNewDiagnosis: () => void;
  onAnalyzeAgain: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f87171',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#34d399',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: '#34d399',
  medium: '#fbbf24',
  low: '#8b909e',
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color,
      background: color + '18',
      border: `1px solid ${color}30`,
      borderRadius: '4px',
      padding: '2px 7px',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bd-bg-surface, #16181c)',
      border: '1px solid var(--bd-border, #2a2d35)',
      borderRadius: '8px',
      padding: '20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: '14px',
      fontWeight: 600,
      color: '#8b909e',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      margin: '0 0 12px 0',
    }}>
      {children}
    </h2>
  );
}

export default function ReportView({ input, result, onNewDiagnosis, onAnalyzeAgain }: Props) {
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [copied, setCopied] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [showAllInspectedFiles, setShowAllInspectedFiles] = useState(false);

  const { report, projectSnapshot, deterministicFindings, filesInspected, githubRateLimit, aiUsed, processingMs } = result;
  const pd = report.primaryDiagnosis;

  const handleCopyMarkdown = useCallback(() => {
    const md = generateMarkdownReport(input, result);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for environments without clipboard API
      const ta = document.createElement('textarea');
      ta.value = md;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [input, result]);

  const handleDownloadJSON = useCallback(() => {
    // Create a safe export (no raw secrets, no full logs)
    const safeExport = {
      report: result.report,
      projectSnapshot: result.projectSnapshot,
      deterministicFindings: result.deterministicFindings,
      filesInspected: result.filesInspected,
      githubRateLimit: result.githubRateLimit,
      aiUsed: result.aiUsed,
      processingMs: result.processingMs,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(safeExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'builddoctor-report.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [result]);

  // Filter findings for display
  const filteredFindings = deterministicFindings.filter(f => {
    if (filter === 'all') return true;
    if (filter === 'critical' || filter === 'high' || filter === 'medium' || filter === 'low') {
      return f.severity === filter;
    }
    return true;
  });

  const filteredEvidence = report.evidence.filter(ev => {
    if (filter === 'log-evidence') return ev.source === 'build-log';
    if (filter === 'repository-evidence') return ev.source === 'repository' || ev.source === 'configuration';
    return true;
  });

  const filterButtons: { value: ReportFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'log-evidence', label: 'Log Evidence' },
    { value: 'repository-evidence', label: 'Repo Evidence' },
    { value: 'patches', label: 'Patches' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-live="polite"
      aria-label="Diagnosis report"
    >
      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          background: report.status === 'diagnosed' ? 'rgba(52,211,153,0.08)' : 'rgba(245,158,11,0.08)',
          border: `1px solid ${report.status === 'diagnosed' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '18px' }}>
          {report.status === 'diagnosed' ? '✓' : report.status === 'partial' ? '◑' : '?'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontWeight: 600,
            color: report.status === 'diagnosed' ? '#34d399' : '#f59e0b',
            fontSize: '14px',
          }}>
            {report.status === 'diagnosed' ? 'Diagnosis complete' :
              report.status === 'partial' ? 'Partial diagnosis' : 'Insufficient evidence'}
          </span>
          {aiUsed && (
            <span style={{ marginLeft: '8px', fontSize: '12px', color: '#22d3ee' }}>
              + AI analysis (Gemini)
            </span>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#555a68' }}>{processingMs}ms</span>
      </motion.div>

      {/* Primary Diagnosis */}
      <Card style={{ marginBottom: '16px', borderColor: SEVERITY_COLORS[pd.severity] + '40' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
          <Badge label={pd.severity} color={SEVERITY_COLORS[pd.severity]} />
          <Badge label={pd.confidence + ' confidence'} color={CONFIDENCE_COLORS[pd.confidence]} />
          <span style={{ fontSize: '11px', color: '#555a68', background: '#1e2028', border: '1px solid #2a2d35', borderRadius: '4px', padding: '2px 7px' }}>
            {pd.category}
          </span>
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8eaf0', margin: '0 0 8px 0', lineHeight: 1.3 }}>
          {pd.title}
        </h2>
        <p style={{ color: '#8b909e', fontSize: '14px', margin: '0 0 12px 0', lineHeight: 1.6 }}>{pd.summary}</p>
        {pd.whyItFails && (
          <details>
            <summary style={{ fontSize: '13px', color: '#f59e0b', cursor: 'pointer', userSelect: 'none' }}>
              Why it fails
            </summary>
            <p style={{ color: '#8b909e', fontSize: '13px', margin: '8px 0 0 0', lineHeight: 1.6 }}>{pd.whyItFails}</p>
          </details>
        )}
      </Card>

      {/* Project Snapshot */}
      {projectSnapshot && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Project Snapshot</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
            {[
              { label: 'Framework', value: projectSnapshot.framework },
              { label: 'Package Manager', value: projectSnapshot.packageManager && (projectSnapshot.packageManager + (projectSnapshot.packageManagerVersion ? ' ' + projectSnapshot.packageManagerVersion : '')) },
              { label: 'Language', value: projectSnapshot.primaryLanguage },
              { label: 'Node Required', value: projectSnapshot.nodeVersionRequirement },
              { label: 'TypeScript', value: projectSnapshot.typescriptUsage ? 'Yes' : 'No' },
              { label: 'Monorepo', value: projectSnapshot.isMonorepo ? 'Yes' : 'No' },
              { label: 'Build Command', value: projectSnapshot.buildCommand },
              { label: 'Deploy Config', value: projectSnapshot.deploymentConfig },
            ].filter(i => i.value).map(item => (
              <div key={item.label} style={{
                background: '#1e2028',
                borderRadius: '4px',
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: '11px', color: '#555a68', marginBottom: '2px' }}>{item.label}</div>
                <div style={{
                  fontSize: '13px',
                  color: '#e8eaf0',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {projectSnapshot.lockfiles.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#555a68' }}>
              Lockfiles: {projectSnapshot.lockfiles.join(', ')}
            </div>
          )}
        </Card>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {filterButtons.map(fb => (
          <button
            key={fb.value}
            onClick={() => setFilter(fb.value)}
            aria-pressed={filter === fb.value}
            style={{
              fontSize: '12px',
              padding: '8px 12px',
              minHeight: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: `1px solid ${filter === fb.value ? '#f59e0b' : '#2a2d35'}`,
              background: filter === fb.value ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: filter === fb.value ? '#f59e0b' : '#8b909e',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {fb.label}
          </button>
        ))}
      </div>

      {/* Evidence */}
      {filter !== 'patches' && filteredEvidence.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Evidence ({filteredEvidence.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredEvidence.map(ev => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvidenceId(selectedEvidenceId === ev.id ? null : ev.id)}
                style={{
                  background: '#1e2028',
                  border: `1px solid ${selectedEvidenceId === ev.id ? '#f59e0b' : '#2a2d35'}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    color: ev.source === 'build-log' ? '#22d3ee' : '#f59e0b',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}>
                    {ev.source}
                  </span>
                  {ev.file && (
                    <span style={{
                      fontSize: '11px',
                      color: '#555a68',
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px',
                      whiteSpace: 'nowrap',
                    }}>
                      {ev.file}{ev.lineStart ? `:${ev.lineStart}` : ''}
                    </span>
                  )}
                </div>
                <pre style={{
                  margin: '6px 0',
                  fontSize: '12px',
                  color: '#e8eaf0',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: selectedEvidenceId === ev.id ? 'none' : '80px',
                  background: '#0f0f11',
                  padding: '8px',
                  borderRadius: '4px',
                }}>
                  {ev.excerpt.slice(0, 500)}
                </pre>
                <p style={{ fontSize: '12px', color: '#8b909e', margin: 0 }}>{ev.explanation}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Deterministic Findings */}
      {filter !== 'patches' && (filter === 'all' || ['critical', 'high', 'medium', 'low'].includes(filter)) && filteredFindings.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Deterministic Findings ({filteredFindings.length})</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredFindings.map(finding => (
              <div key={finding.id} style={{
                background: '#1e2028',
                border: `1px solid ${SEVERITY_COLORS[finding.severity]}30`,
                borderLeft: `3px solid ${SEVERITY_COLORS[finding.severity]}`,
                borderRadius: '4px',
                padding: '10px 12px',
              }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge label={finding.severity} color={SEVERITY_COLORS[finding.severity]} />
                  <span style={{ fontSize: '11px', color: '#555a68', fontFamily: 'ui-monospace, Consolas, monospace' }}>
                    {finding.category}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#e8eaf0', marginBottom: '4px' }}>
                  {finding.title}
                </div>
                <p style={{ fontSize: '13px', color: '#8b909e', margin: '0 0 6px 0', lineHeight: 1.5 }}>{finding.summary}</p>
                <p style={{ fontSize: '12px', color: '#f59e0b', margin: 0 }}>
                  → {finding.recommendedAction}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Contributing Factors */}
      {filter === 'all' && report.contributingFactors.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Contributing Factors</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.contributingFactors.map((factor, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <Badge label={factor.severity} color={SEVERITY_COLORS[factor.severity]} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e8eaf0' }}>{factor.title}</div>
                  <p style={{ fontSize: '12px', color: '#8b909e', margin: '2px 0 0 0' }}>{factor.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Repair Plan */}
      {(filter === 'all' || filter === 'critical' || filter === 'high') && report.repairPlan.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Repair Plan</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.repairPlan.map(step => (
              <div key={step.order} style={{
                background: '#1e2028',
                borderRadius: '6px',
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#f59e0b',
                    color: '#0f0f11',
                    fontWeight: 700,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {step.order}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8eaf0' }}>{step.title}</span>
                      <span style={{
                        fontSize: '11px',
                        color: step.risk === 'high' ? '#f87171' : step.risk === 'medium' ? '#fbbf24' : '#34d399',
                        background: (step.risk === 'high' ? '#f87171' : step.risk === 'medium' ? '#fbbf24' : '#34d399') + '18',
                        border: '1px solid ' + (step.risk === 'high' ? '#f87171' : step.risk === 'medium' ? '#fbbf24' : '#34d399') + '30',
                        borderRadius: '4px',
                        padding: '1px 6px',
                      }}>
                        {step.risk} risk
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#8b909e', margin: '0 0 6px 0', lineHeight: 1.5 }}>{step.description}</p>
                    {step.commands && step.commands.length > 0 && (
                      <div style={{ overflow: 'auto' }}>
                        <pre style={{
                          background: '#0f0f11',
                          border: '1px solid #2a2d35',
                          borderRadius: '4px',
                          padding: '8px 10px',
                          fontSize: '12px',
                          color: '#34d399',
                          fontFamily: 'ui-monospace, Consolas, monospace',
                          margin: 0,
                          overflowX: 'auto',
                        }}>
                          {step.commands.join('\n')}
                        </pre>
                      </div>
                    )}
                    <p style={{ fontSize: '12px', color: '#555a68', margin: '4px 0 0 0' }}>
                      Expected: {step.expectedOutcome}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Suggested Patches */}
      {(filter === 'all' || filter === 'patches') && report.suggestedPatches.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Suggested Patches</SectionTitle>
          <div style={{
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '4px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#f59e0b',
          }}>
            Advisory only — review all patches before applying. BuildDoctor does not modify your repository.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {report.suggestedPatches.map((patch, i) => (
              <div key={i} style={{
                background: '#1e2028',
                borderRadius: '6px',
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <code style={{
                    fontSize: '13px',
                    color: '#22d3ee',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    wordBreak: 'break-all',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {patch.file}
                  </code>
                  <Badge label={patch.confidence + ' confidence'} color={CONFIDENCE_COLORS[patch.confidence]} />
                </div>
                <p style={{ fontSize: '13px', color: '#8b909e', margin: '0 0 8px 0' }}>{patch.rationale}</p>
                {patch.before && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '4px' }}>Before:</div>
                    <div style={{ overflowX: 'auto' }}>
                      <pre style={{
                        background: 'rgba(248,113,113,0.06)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        borderRadius: '4px',
                        padding: '8px 10px',
                        fontSize: '12px',
                        color: '#f87171',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        margin: 0,
                        whiteSpace: 'pre',
                      }}>
                        {patch.before}
                      </pre>
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '11px', color: '#34d399', marginBottom: '4px' }}>After:</div>
                  <div style={{ overflowX: 'auto' }}>
                    <pre style={{
                      background: 'rgba(52,211,153,0.06)',
                      border: '1px solid rgba(52,211,153,0.2)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      color: '#34d399',
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      margin: 0,
                      whiteSpace: 'pre',
                    }}>
                      {patch.after}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Verification Commands */}
      {filter === 'all' && report.verificationCommands.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Verification Commands</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {report.verificationCommands.map((cmd, i) => (
              <div key={i}>
                <div style={{ fontSize: '13px', color: '#8b909e', marginBottom: '4px' }}>{cmd.description}</div>
                <div style={{ overflowX: 'auto' }}>
                  <pre style={{
                    background: '#0f0f11',
                    border: '1px solid #2a2d35',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#34d399',
                    fontFamily: 'ui-monospace, Consolas, monospace',
                    margin: 0,
                    whiteSpace: 'pre',
                  }}>
                    $ {cmd.command}
                  </pre>
                </div>
                <div style={{ fontSize: '11px', color: '#555a68', marginTop: '4px' }}>Expected: {cmd.expectedOutcome}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Unresolved Questions */}
      {filter === 'all' && report.unresolvedQuestions.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Unresolved Questions</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#8b909e', fontSize: '13px', lineHeight: 1.7 }}>
            {report.unresolvedQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </Card>
      )}

      {/* Limitations */}
      {filter === 'all' && report.limitations.length > 0 && (
        <Card style={{ marginBottom: '16px', borderColor: '#2a2d35' }}>
          <SectionTitle>Limitations</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#555a68', fontSize: '12px', lineHeight: 1.7 }}>
            {report.limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </Card>
      )}

      {/* Files Inspected */}
      {filter === 'all' && filesInspected.length > 0 && (
        <Card style={{ marginBottom: '16px' }}>
          <SectionTitle>Files Inspected ({filesInspected.length})</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(showAllInspectedFiles ? filesInspected : filesInspected.slice(0, 10)).map(f => (
              <code key={f} style={{
                fontSize: '11px',
                color: '#22d3ee',
                background: 'rgba(34,211,238,0.06)',
                border: '1px solid rgba(34,211,238,0.15)',
                borderRadius: '3px',
                padding: '2px 6px',
                fontFamily: 'ui-monospace, Consolas, monospace',
                wordBreak: 'break-all',
              }}>
                {f}
              </code>
            ))}
          </div>
          {filesInspected.length > 10 && (
            <button
              type="button"
              aria-expanded={showAllInspectedFiles}
              onClick={() => setShowAllInspectedFiles(value => !value)}
              style={{ marginTop: '12px', background: 'transparent', border: '1px solid #2a2d35', borderRadius: '4px', color: '#22d3ee', cursor: 'pointer', padding: '6px 9px', fontSize: '12px' }}
            >
              {showAllInspectedFiles ? 'Show fewer inspected files' : 'Show all inspected files'}
            </button>
          )}
        </Card>
      )}

      {/* GitHub Rate Limit */}
      {githubRateLimit && (
        <div style={{
          fontSize: '12px',
          color: '#555a68',
          marginBottom: '16px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span>GitHub API: {githubRateLimit.remaining}/{githubRateLimit.limit} remaining</span>
          <span>{githubRateLimit.authenticated ? 'Authenticated' : 'Unauthenticated (60 req/hr limit)'}</span>
          {githubRateLimit.resetAt && <span>Resets: {new Date(githubRateLimit.resetAt).toLocaleTimeString()}</span>}
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        paddingTop: '16px',
        borderTop: '1px solid var(--bd-border, #2a2d35)',
      }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCopyMarkdown}
          style={{
            padding: '10px 18px',
            background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: '6px',
            color: copied ? '#34d399' : '#f59e0b',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 150ms, color 150ms',
          }}
        >
          {copied ? '✓ Copied!' : '📋 Copy Markdown'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDownloadJSON}
          style={{
            padding: '10px 18px',
            background: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.2)',
            borderRadius: '6px',
            color: '#22d3ee',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ↓ Download JSON
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAnalyzeAgain}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: '1px solid var(--bd-border, #2a2d35)',
            borderRadius: '6px',
            color: 'var(--bd-text-secondary, #8b909e)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ↺ Analyze Again
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewDiagnosis}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: '1px solid var(--bd-border, #2a2d35)',
            borderRadius: '6px',
            color: 'var(--bd-text-secondary, #8b909e)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          + New Diagnosis
        </motion.button>
      </div>
    </motion.div>
  );
}
