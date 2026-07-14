/**
 * Markdown export for BuildDoctor diagnosis reports.
 */

import type { DiagnoseResponse } from './types';
import type { DiagnoseInput } from './types';

const DISCLAIMER = `
---
*BuildDoctor is a diagnostic assistant. Suggested patches are advisory only and must be reviewed before application. BuildDoctor does not execute repository code or guarantee that fixes will work. AI recommendations may be incorrect.*
`;

export function generateMarkdownReport(
  input: DiagnoseInput,
  result: DiagnoseResponse
): string {
  const { report, projectSnapshot, deterministicFindings, filesInspected, githubRateLimit } = result;
  const pd = report.primaryDiagnosis;

  const lines: string[] = [
    '# BuildDoctor Diagnosis Report',
    '',
    `**Repository:** ${input.repositoryUrl ?? 'Not provided'}`,
    input.gitRef ? `**Ref:** ${input.gitRef}` : '',
    `**Platform:** ${input.platform}`,
    `**AI Analysis:** ${report.usedAI ? 'Yes (Gemini)' : 'No (deterministic only)'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
    '## Diagnosis Status',
    '',
    `**Status:** ${report.status}`,
    '',
    '## Primary Diagnosis',
    '',
    `### ${pd.title}`,
    '',
    `- **Category:** ${pd.category}`,
    `- **Severity:** ${pd.severity}`,
    `- **Confidence:** ${pd.confidence}`,
    '',
    '**Summary:**',
    pd.summary,
    '',
    '**Why It Fails:**',
    pd.whyItFails,
    '',
  ];

  // Project Snapshot
  if (projectSnapshot) {
    lines.push('## Project Snapshot', '');
    const ps = projectSnapshot;
    lines.push(`| Field | Value |`);
    lines.push(`| ----- | ----- |`);
    if (ps.framework) lines.push(`| Framework | ${ps.framework} |`);
    if (ps.packageManager) lines.push(`| Package Manager | ${ps.packageManager}${ps.packageManagerVersion ? ' ' + ps.packageManagerVersion : ''} |`);
    if (ps.nodeVersionRequirement) lines.push(`| Node Required | ${ps.nodeVersionRequirement} |`);
    if (ps.buildCommand) lines.push(`| Build Command | \`${ps.buildCommand}\` |`);
    lines.push(`| TypeScript | ${ps.typescriptUsage ? 'Yes' : 'No'} |`);
    lines.push(`| Monorepo | ${ps.isMonorepo ? 'Yes' : 'No'} |`);
    if (ps.lockfiles.length > 0) lines.push(`| Lockfiles | ${ps.lockfiles.join(', ')} |`);
    lines.push('');
  }

  // Evidence
  if (report.evidence.length > 0) {
    lines.push('## Evidence', '');
    for (const ev of report.evidence) {
      lines.push(`### ${ev.source} evidence${ev.file ? `: \`${ev.file}\`` : ''}`);
      if (ev.lineStart) lines.push(`Lines: ${ev.lineStart}${ev.lineEnd !== ev.lineStart ? `-${ev.lineEnd}` : ''}`);
      lines.push('');
      lines.push('```');
      lines.push(ev.excerpt.slice(0, 500));
      lines.push('```');
      lines.push('');
      lines.push(`*${ev.explanation}*`);
      lines.push('');
    }
  }

  // Contributing Factors
  if (report.contributingFactors.length > 0) {
    lines.push('## Contributing Factors', '');
    for (const factor of report.contributingFactors) {
      lines.push(`### ${factor.title} (${factor.severity})`);
      lines.push(factor.description);
      lines.push('');
    }
  }

  // Deterministic Findings
  if (deterministicFindings.length > 0) {
    lines.push('## Deterministic Findings', '');
    for (const finding of deterministicFindings) {
      lines.push(`### ${finding.title}`);
      lines.push(`- **Category:** ${finding.category}`);
      lines.push(`- **Severity:** ${finding.severity}`);
      lines.push(`- **Confidence:** ${finding.confidence}`);
      lines.push('');
      lines.push(finding.summary);
      lines.push('');
      lines.push(`**Action:** ${finding.recommendedAction}`);
      lines.push('');
    }
  }

  // Repair Plan
  if (report.repairPlan.length > 0) {
    lines.push('## Repair Plan', '');
    for (const step of report.repairPlan) {
      lines.push(`### Step ${step.order}: ${step.title} (risk: ${step.risk})`);
      lines.push(step.description);
      if (step.commands && step.commands.length > 0) {
        lines.push('');
        lines.push('```bash');
        lines.push(step.commands.join('\n'));
        lines.push('```');
      }
      lines.push('');
      lines.push(`**Expected outcome:** ${step.expectedOutcome}`);
      lines.push('');
    }
  }

  // Suggested Patches
  if (report.suggestedPatches.length > 0) {
    lines.push('## Suggested Patches', '');
    lines.push('> **Advisory only.** Review all patches before applying. BuildDoctor does not modify your repository.', '');
    for (const patch of report.suggestedPatches) {
      lines.push(`### ${patch.file} (confidence: ${patch.confidence})`);
      lines.push(patch.rationale);
      lines.push('');
      if (patch.before) {
        lines.push('**Before:**');
        lines.push('```');
        lines.push(patch.before);
        lines.push('```');
        lines.push('');
      }
      lines.push('**After:**');
      lines.push('```');
      lines.push(patch.after);
      lines.push('```');
      lines.push('');
    }
  }

  // Verification Commands
  if (report.verificationCommands.length > 0) {
    lines.push('## Verification Commands', '');
    for (const cmd of report.verificationCommands) {
      lines.push(`**${cmd.description}**`);
      lines.push('```bash');
      lines.push(cmd.command);
      lines.push('```');
      lines.push(`Expected: ${cmd.expectedOutcome}`);
      lines.push('');
    }
  }

  // Unresolved Questions
  if (report.unresolvedQuestions.length > 0) {
    lines.push('## Unresolved Questions', '');
    for (const q of report.unresolvedQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push('');
  }

  // Limitations
  if (report.limitations.length > 0) {
    lines.push('## Limitations', '');
    for (const l of report.limitations) {
      lines.push(`- ${l}`);
    }
    lines.push('');
  }

  // Files Inspected
  if (filesInspected.length > 0) {
    lines.push('## Files Inspected', '');
    for (const f of filesInspected) {
      lines.push(`- \`${f}\``);
    }
    lines.push('');
  }

  // Rate limit info
  if (githubRateLimit) {
    lines.push('## GitHub API', '');
    lines.push(`- Remaining requests: ${githubRateLimit.remaining}/${githubRateLimit.limit}`);
    lines.push(`- Authenticated: ${githubRateLimit.authenticated ? 'Yes' : 'No (unauthenticated limits apply)'}`);
    if (githubRateLimit.resetAt) lines.push(`- Resets at: ${githubRateLimit.resetAt}`);
    lines.push('');
  }

  lines.push(DISCLAIMER);

  return lines.filter(l => l !== undefined).join('\n');
}
