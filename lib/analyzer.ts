/**
 * Modular Developer Diagnostic Analyzer.
 * Decouples deterministic inspection from UI/CLI and console output.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GitHubFile } from './github/client';
import {
  DiagnosticCategory,
  DeterministicFinding,
  StructuredDiagnostic,
  DiagnosticStatus,
  ProjectSnapshot,
  Platform,
} from './types';
import { normalizeBuildLog } from './log-normalizer';
import { detectProject } from './detect-project';
import { runDeterministicDiagnostics } from './diagnostics';

// ── Category to Code Mapping ──────────────────────────────────────────────────

export const CATEGORY_TO_CODE: Record<DiagnosticCategory, string> = {
  PACKAGE_MANAGER_MISMATCH: 'ERR_PACKAGE_MANAGER_MISMATCH',
  LOCKFILE_CONFLICT: 'ERR_LOCKFILE_CONFLICT',
  PEER_DEPENDENCY_CONFLICT: 'ERR_DEPS_MISMATCH',
  MODULE_NOT_FOUND: 'ERR_MODULE_NOT_FOUND',
  IMPORT_CASING_MISMATCH: 'ERR_IMPORT_CASING_MISMATCH',
  PATH_ALIAS_MISMATCH: 'ERR_PATH_ALIAS_MISMATCH',
  MISSING_DEPENDENCY: 'ERR_MISSING_DEPENDENCY',
  NODE_VERSION_MISMATCH: 'ERR_NODE_VERSION_MISMATCH',
  MISSING_ENVIRONMENT_VARIABLE: 'ERR_ENV_VAR_MISSING',
  TYPESCRIPT_ERROR: 'ERR_TYPESCRIPT_ERROR',
  ESLINT_ERROR: 'ERR_ESLINT_ERROR',
  TEST_FAILURE: 'ERR_TEST_FAILURE',
  BUILD_SCRIPT_MISSING: 'ERR_BUILD_SCRIPT_MISSING',
  INVALID_PACKAGE_SCRIPT: 'ERR_INVALID_PACKAGE_JSON',
  NEXT_CONFIG_ERROR: 'ERR_NEXT_CONFIG_ERROR',
  NEXT_APP_ROUTER_ERROR: 'ERR_NEXT_APP_ROUTER_ERROR',
  NEXT_SERVER_CLIENT_BOUNDARY: 'ERR_NEXT_SERVER_CLIENT_BOUNDARY',
  NEXT_STATIC_EXPORT_ERROR: 'ERR_NEXT_STATIC_EXPORT_ERROR',
  VITE_CONFIG_ERROR: 'ERR_VITE_CONFIG_ERROR',
  BUNDLER_ERROR: 'ERR_BUNDLER_ERROR',
  HYDRATION_WARNING: 'WARN_HYDRATION_MISMATCH',
  VERCEL_FUNCTION_TIMEOUT: 'ERR_VERCEL_FUNCTION_TIMEOUT',
  VERCEL_PAYLOAD_LIMIT: 'ERR_VERCEL_PAYLOAD_LIMIT',
  VERCEL_BUILD_COMMAND_ERROR: 'ERR_VERCEL_BUILD_COMMAND_ERROR',
  VERCEL_ROOT_DIRECTORY_ERROR: 'ERR_VERCEL_ROOT_DIRECTORY_ERROR',
  NETLIFY_CONFIG_ERROR: 'ERR_NETLIFY_CONFIG_ERROR',
  GITHUB_ACTIONS_ERROR: 'ERR_GITHUB_ACTIONS_ERROR',
  OUT_OF_MEMORY: 'ERR_OUT_OF_MEMORY',
  PERMISSION_ERROR: 'ERR_PERMISSION_ERROR',
  NETWORK_OR_REGISTRY_FAILURE: 'ERR_NETWORK_OR_REGISTRY_FAILURE',
  RATE_LIMIT: 'ERR_RATE_LIMIT',
  DEPRECATED_PACKAGE: 'WARN_DEPRECATED_PACKAGE',
  UNKNOWN: 'ERR_UNKNOWN',
};

// ── Convert Deterministic Finding to Structured Diagnostic ───────────────────

export function findingToDiagnostic(finding: DeterministicFinding): StructuredDiagnostic {
  const status: DiagnosticStatus =
    finding.severity === 'critical' || finding.severity === 'high' ? 'fail' : 'warn';
  const code = CATEGORY_TO_CODE[finding.category] || 'ERR_UNKNOWN';

  return {
    status,
    code,
    description: finding.summary || finding.title,
    remediation: finding.recommendedAction,
    category: finding.category,
    severity: finding.severity,
    file: finding.evidence[0]?.file,
    evidence: finding.evidence,
  };
}

// ── Modular Analysis Engine ──────────────────────────────────────────────────

export interface AnalysisOptions {
  files: GitHubFile[];
  buildLog?: string;
  projectContext?: string;
  platform?: Platform;
  repositoryName?: string;
  selectedRef?: string;
  onLog?: (message: string, data?: unknown) => void;
}

export interface AnalysisReport {
  status: DiagnosticStatus;
  diagnostics: StructuredDiagnostic[];
  findings: DeterministicFinding[];
  snapshot: ProjectSnapshot;
  filesInspected: string[];
}

/**
 * Pure analyzer function: accepts context/files and returns structured diagnostics
 * without any hardcoded console side-effects.
 */
export function analyzeProject(options: AnalysisOptions): AnalysisReport {
  const {
    files,
    buildLog,
    platform: _platform = 'local',
    repositoryName = 'project',
    selectedRef,
    onLog,
  } = options;

  onLog?.('Normalizing build log and detecting project metadata...');

  const normalizedLog = buildLog ? normalizeBuildLog(buildLog) : null;
  const snapshot = detectProject(files, repositoryName, selectedRef);
  const findings = runDeterministicDiagnostics(normalizedLog, files, snapshot);

  onLog?.(`Deterministic diagnostics complete: found ${findings.length} findings.`);

  const diagnostics: StructuredDiagnostic[] = findings.map(findingToDiagnostic);

  if (diagnostics.length === 0) {
    diagnostics.push({
      status: 'pass',
      code: 'OK_PROJECT_HEALTHY',
      description: 'No build configuration or dependency issues detected.',
      remediation: 'Project configuration satisfies deterministic inspection rules.',
    });
  }

  const hasFail = diagnostics.some(d => d.status === 'fail');
  const hasWarn = diagnostics.some(d => d.status === 'warn');
  const overallStatus: DiagnosticStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

  return {
    status: overallStatus,
    diagnostics,
    findings,
    snapshot,
    filesInspected: files.map(f => f.path),
  };
}

// ── Directory-based Inspection (Local / Headless) ────────────────────────────

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.vercel',
]);

const ALLOWED_CONFIG_FILENAMES = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'bun.lock',
  'tsconfig.json',
  'jsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'vercel.json',
  'netlify.toml',
  'turbo.json',
  '.nvmrc',
  '.node-version',
]);

/**
 * Recursively inspects a local directory into a list of normalized GitHubFile structures.
 */
export function readDirectoryAsFiles(dirPath: string, rootPath: string = dirPath): GitHubFile[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results: GitHubFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      results.push(...readDirectoryAsFiles(fullPath, rootPath));
    } else if (entry.isFile()) {
      const filename = entry.name;
      const isConfig = ALLOWED_CONFIG_FILENAMES.has(filename);
      const isTopSource =
        (relPath.startsWith('src/') || relPath.startsWith('app/') || relPath.startsWith('pages/')) &&
        /\.(ts|tsx|js|jsx)$/.test(filename);

      if (isConfig || isTopSource) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          results.push({
            path: relPath,
            content,
            size: content.length,
          });
        } catch {
          // Ignore unreadable files
        }
      }
    }
  }

  return results;
}

export interface AnalyzeDirectoryOptions {
  buildLog?: string;
  projectContext?: string;
  platform?: Platform;
  repositoryName?: string;
  selectedRef?: string;
  onLog?: (message: string, data?: unknown) => void;
}

/**
 * Analyzes a local directory target path, producing structured diagnostics.
 */
export function analyzeDirectory(
  targetPath: string,
  options?: AnalyzeDirectoryOptions
): AnalysisReport {
  const files = readDirectoryAsFiles(targetPath);
  return analyzeProject({
    files,
    buildLog: options?.buildLog,
    projectContext: options?.projectContext,
    platform: options?.platform,
    repositoryName: options?.repositoryName || path.basename(targetPath),
    selectedRef: options?.selectedRef,
    onLog: options?.onLog,
  });
}
