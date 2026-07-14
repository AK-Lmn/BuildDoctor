/**
 * Deterministic diagnostic engine.
 * Runs pattern-based analysis BEFORE AI synthesis.
 */

import type { GitHubFile } from './github/client';
import type {
  DeterministicFinding,
  NormalizedLog,
  DiagnosticSignal,
  EvidenceItem,
  ProjectSnapshot,
  DiagnosticCategory,
  Severity,
} from './types';
import { LIMITS } from './config';

let _findingCounter = 0;
function nextId(): string {
  return `det-${++_findingCounter}`;
}

function nextEvidenceId(): string {
  return `ev-${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonSafe(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function findFile(files: GitHubFile[], ...names: string[]): GitHubFile | undefined {
  for (const name of names) {
    const found = files.find(f => f.path.endsWith('/' + name) || f.path === name);
    if (found) return found;
  }
  return undefined;
}

// ── Individual checks ─────────────────────────────────────────────────────────

function checkCompetingLockfiles(files: GitHubFile[]): DeterministicFinding | null {
  const lockfileNames = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock'];
  const found = lockfileNames.filter(name => files.some(f => f.path.endsWith(name)));

  if (found.length < 2) return null;

  return {
    id: nextId(),
    category: 'LOCKFILE_CONFLICT',
    severity: 'high',
    confidence: 'high',
    title: 'Multiple competing lockfiles detected',
    summary: `Found ${found.join(', ')} — having multiple lockfiles causes package manager confusion and non-deterministic installs.`,
    evidence: [
      {
        id: nextEvidenceId(),
        source: 'repository',
        excerpt: found.join(', '),
        explanation: 'Multiple lockfiles found in the repository root.',
      },
    ],
    recommendedAction: 'Remove all lockfiles except the one matching your chosen package manager, then regenerate it.',
  };
}

function checkPackageManagerMismatch(
  files: GitHubFile[],
  snapshot: Partial<ProjectSnapshot>
): DeterministicFinding | null {
  const pmName = snapshot.packageManager;
  if (!pmName) return null;

  const hasPackageLock = files.some(f => f.path.endsWith('package-lock.json'));
  const hasYarnLock = files.some(f => f.path.endsWith('yarn.lock'));
  const hasPnpmLock = files.some(f => f.path.endsWith('pnpm-lock.yaml'));

  const mismatch =
    (pmName === 'pnpm' && (hasPackageLock || hasYarnLock)) ||
    (pmName === 'yarn' && (hasPackageLock || hasPnpmLock)) ||
    (pmName === 'npm' && (hasYarnLock || hasPnpmLock));

  if (!mismatch) return null;

  return {
    id: nextId(),
    category: 'PACKAGE_MANAGER_MISMATCH',
    severity: 'high',
    confidence: 'high',
    title: `Package manager mismatch: ${pmName} declared but different lockfile present`,
    summary: `package.json declares ${pmName} but a conflicting lockfile is present. CI may use a different package manager than development.`,
    evidence: [
      {
        id: nextEvidenceId(),
        source: 'repository',
        excerpt: `packageManager: ${pmName}, lockfiles: ${snapshot.lockfiles?.join(', ')}`,
        explanation: 'The declared package manager and lockfile do not match.',
      },
    ],
    recommendedAction: `Delete the conflicting lockfiles and run \`${pmName} install\` to generate the correct lockfile.`,
  };
}

function checkMissingBuildScript(files: GitHubFile[]): DeterministicFinding | null {
  const pkgFile = findFile(files, 'package.json');
  if (!pkgFile) return null;

  const pkg = parseJsonSafe(pkgFile.content) as { scripts?: Record<string, string> } | null;
  if (!pkg) return null;

  if (!pkg.scripts?.build) {
    return {
      id: nextId(),
      category: 'BUILD_SCRIPT_MISSING',
      severity: 'critical',
      confidence: 'high',
      title: 'No "build" script in package.json',
      summary: 'package.json does not define a "build" script. CI/CD platforms require this to build the project.',
      evidence: [
        {
          id: nextEvidenceId(),
          source: 'repository',
          file: pkgFile.path,
          excerpt: JSON.stringify(pkg.scripts ?? {}, null, 2).slice(0, 300),
          explanation: 'No build script found in scripts field.',
        },
      ],
      recommendedAction: 'Add a "build" script to package.json, e.g. "build": "next build" or "build": "vite build".',
    };
  }

  return null;
}

function checkMalformedPackageJson(files: GitHubFile[]): DeterministicFinding | null {
  const pkgFile = findFile(files, 'package.json');
  if (!pkgFile) return null;

  const pkg = parseJsonSafe(pkgFile.content);
  if (pkg) return null; // Valid JSON

  return {
    id: nextId(),
    category: 'INVALID_PACKAGE_SCRIPT',
    severity: 'critical',
    confidence: 'high',
    title: 'package.json contains invalid JSON',
    summary: 'package.json cannot be parsed as valid JSON. This will cause all package manager operations to fail.',
    evidence: [
      {
        id: nextEvidenceId(),
        source: 'repository',
        file: pkgFile.path,
        excerpt: pkgFile.content.slice(0, 200),
        explanation: 'JSON.parse failed on package.json content.',
      },
    ],
    recommendedAction: 'Validate package.json with a JSON linter (e.g., jsonlint) and fix syntax errors.',
  };
}

function checkDuplicateDependencies(files: GitHubFile[]): DeterministicFinding | null {
  const pkgFile = findFile(files, 'package.json');
  if (!pkgFile) return null;

  const pkg = parseJsonSafe(pkgFile.content) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
  if (!pkg) return null;

  const deps = Object.keys(pkg.dependencies ?? {});
  const devDeps = Object.keys(pkg.devDependencies ?? {});
  const duplicates = deps.filter(d => devDeps.includes(d));

  if (duplicates.length === 0) return null;

  return {
    id: nextId(),
    category: 'PEER_DEPENDENCY_CONFLICT',
    severity: 'medium',
    confidence: 'high',
    title: `Packages in both dependencies and devDependencies: ${duplicates.slice(0, 5).join(', ')}`,
    summary: 'These packages are declared in both dependencies and devDependencies, which can cause version conflicts.',
    evidence: [
      {
        id: nextEvidenceId(),
        source: 'repository',
        file: pkgFile.path,
        excerpt: `Duplicates: ${duplicates.join(', ')}`,
        explanation: 'Package appears in both dependencies and devDependencies.',
      },
    ],
    recommendedAction: 'Move these packages to only one section. Runtime packages belong in dependencies; build-time-only in devDependencies.',
  };
}

function checkNodeVersionMismatch(
  files: GitHubFile[],
  snapshot: Partial<ProjectSnapshot>
): DeterministicFinding | null {
  const required = snapshot.nodeVersionRequirement;
  if (!required) return null;

  // Check if vercel.json or netlify.toml specify a different Node
  const vercelFile = findFile(files, 'vercel.json');
  if (vercelFile) {
    const vercel = parseJsonSafe(vercelFile.content) as { build?: { env?: { NODE_VERSION?: string } } } | null;
    const vercelNode = vercel?.build?.env?.NODE_VERSION;
    if (vercelNode && required && !required.includes(vercelNode)) {
      return {
        id: nextId(),
        category: 'NODE_VERSION_MISMATCH',
        severity: 'high',
        confidence: 'medium',
        title: `Node version mismatch: package.json requires "${required}", Vercel config specifies "${vercelNode}"`,
        summary: 'The Node version required by package.json engines field differs from the Vercel deployment configuration.',
        evidence: [
          {
            id: nextEvidenceId(),
            source: 'configuration',
            file: 'vercel.json',
            excerpt: `NODE_VERSION: ${vercelNode}`,
            explanation: 'Vercel build environment NODE_VERSION differs from package.json engines.node.',
          },
        ],
        recommendedAction: 'Align the Node version in vercel.json with package.json engines.node.',
      };
    }
  }

  return null;
}

// ── Log-based checks ──────────────────────────────────────────────────────────

function findingsFromSignals(
  signals: DiagnosticSignal[],
  _log: NormalizedLog
): DeterministicFinding[] {
  const findings: DeterministicFinding[] = [];
  const seen = new Set<string>();

  // Group by category
  const byCategory = new Map<DiagnosticCategory, DiagnosticSignal[]>();
  for (const signal of signals) {
    if (!byCategory.has(signal.category)) byCategory.set(signal.category, []);
    byCategory.get(signal.category)!.push(signal);
  }

  for (const [category, categorySignals] of byCategory) {
    if (seen.has(category)) continue;
    seen.add(category);

    // Use the last occurrence (closest to failure)
    const primary = categorySignals[categorySignals.length - 1];

    const evidence: EvidenceItem[] = categorySignals.slice(-3).map(s => ({
      id: nextEvidenceId(),
      source: 'build-log' as const,
      lineStart: s.lineNumber,
      lineEnd: s.lineNumber,
      excerpt: s.excerpt,
      explanation: `Matched pattern: ${s.pattern}`,
    }));

    const severityMap: Record<string, Severity> = {
      MODULE_NOT_FOUND: 'critical',
      PEER_DEPENDENCY_CONFLICT: 'high',
      TYPESCRIPT_ERROR: 'high',
      ESLINT_ERROR: 'medium',
      BUILD_SCRIPT_MISSING: 'critical',
      LOCKFILE_CONFLICT: 'high',
      NODE_VERSION_MISMATCH: 'high',
      MISSING_ENVIRONMENT_VARIABLE: 'high',
      VERCEL_FUNCTION_TIMEOUT: 'critical',
      OUT_OF_MEMORY: 'critical',
      NETWORK_OR_REGISTRY_FAILURE: 'high',
    };

    const severity: Severity = (severityMap[category] as Severity) ?? 'medium';

    findings.push({
      id: nextId(),
      category,
      severity,
      confidence: categorySignals.length >= 2 ? 'high' : 'medium',
      title: categoryTitle(category, primary.excerpt),
      summary: `Detected ${categorySignals.length} occurrence(s) of ${category} pattern in build log.`,
      evidence,
      recommendedAction: categoryAction(category),
    });
  }

  return findings;
}

function categoryTitle(category: DiagnosticCategory, excerpt: string): string {
  const titles: Partial<Record<DiagnosticCategory, string>> = {
    MODULE_NOT_FOUND: 'Module not found error',
    PEER_DEPENDENCY_CONFLICT: 'Peer dependency conflict',
    TYPESCRIPT_ERROR: 'TypeScript compilation error',
    ESLINT_ERROR: 'ESLint error blocking build',
    BUILD_SCRIPT_MISSING: 'Build script missing',
    LOCKFILE_CONFLICT: 'Lockfile conflict',
    NODE_VERSION_MISMATCH: 'Node.js version mismatch',
    MISSING_ENVIRONMENT_VARIABLE: 'Missing environment variable',
    VERCEL_FUNCTION_TIMEOUT: 'Vercel function timeout',
    VERCEL_PAYLOAD_LIMIT: 'Vercel payload size exceeded',
    OUT_OF_MEMORY: 'Out of memory error',
    NETWORK_OR_REGISTRY_FAILURE: 'Network or registry failure',
    NEXT_SERVER_CLIENT_BOUNDARY: 'Next.js server/client boundary violation',
    HYDRATION_WARNING: 'React hydration mismatch',
    PACKAGE_MANAGER_MISMATCH: 'Package manager mismatch',
    PATH_ALIAS_MISMATCH: 'Path alias not resolved',
    RATE_LIMIT: 'Rate limit hit',
    PERMISSION_ERROR: 'Permission denied',
  };

  return titles[category] ?? `${category}: ${excerpt.slice(0, 80)}`;
}

function categoryAction(category: DiagnosticCategory): string {
  const actions: Partial<Record<DiagnosticCategory, string>> = {
    MODULE_NOT_FOUND: 'Verify the import path exists in the repository, check filename casing, and confirm the module is installed.',
    PEER_DEPENDENCY_CONFLICT: 'Review conflicting peer dependency requirements and align package versions.',
    TYPESCRIPT_ERROR: 'Fix TypeScript errors reported in the log. Run `npx tsc --noEmit` locally.',
    ESLINT_ERROR: 'Fix ESLint errors. Run `npm run lint` locally to see all issues.',
    BUILD_SCRIPT_MISSING: 'Add a "build" script to package.json.',
    LOCKFILE_CONFLICT: 'Remove conflicting lockfiles and regenerate with a single package manager.',
    NODE_VERSION_MISMATCH: 'Ensure the Node.js version in your CI/CD environment matches your engines requirement.',
    MISSING_ENVIRONMENT_VARIABLE: 'Add required environment variables to your deployment platform.',
    VERCEL_FUNCTION_TIMEOUT: 'Optimize the serverless function to complete within Vercel\'s timeout limit, or increase maxDuration.',
    OUT_OF_MEMORY: 'Increase the Node.js heap size with NODE_OPTIONS="--max-old-space-size=4096" or optimize memory usage.',
    NETWORK_OR_REGISTRY_FAILURE: 'Check registry connectivity, retry the build, or use a local cache.',
    NEXT_SERVER_CLIENT_BOUNDARY: 'Add "use client" directive to client components or move server-only imports to server components.',
    HYDRATION_WARNING: 'Ensure server and client render identical HTML. Avoid browser-only APIs in initial render.',
    PACKAGE_MANAGER_MISMATCH: 'Use the same package manager for development and CI.',
    PATH_ALIAS_MISMATCH: 'Verify tsconfig.json path aliases and ensure imported files exist at the mapped paths.',
    RATE_LIMIT: 'Wait for rate limit reset or authenticate your package manager requests.',
    PERMISSION_ERROR: 'Check file permissions and ensure the build user has necessary access.',
  };

  return actions[category] ?? 'Review the build log for more details and address the root cause.';
}

// ── Rank findings ─────────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const CONFIDENCE_WEIGHT: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function rankFindings(findings: DeterministicFinding[]): DeterministicFinding[] {
  return [...findings].sort((a, b) => {
    const scoreA = SEVERITY_WEIGHT[a.severity] * 2 + CONFIDENCE_WEIGHT[a.confidence];
    const scoreB = SEVERITY_WEIGHT[b.severity] * 2 + CONFIDENCE_WEIGHT[b.confidence];
    return scoreB - scoreA;
  });
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runDeterministicDiagnostics(
  log: NormalizedLog | null,
  files: GitHubFile[],
  snapshot: Partial<ProjectSnapshot>
): DeterministicFinding[] {
  _findingCounter = 0;
  const findings: DeterministicFinding[] = [];

  // Repository-based checks
  if (files.length > 0) {
    const cf = checkCompetingLockfiles(files);
    if (cf) findings.push(cf);

    const pm = checkPackageManagerMismatch(files, snapshot);
    if (pm) findings.push(pm);

    const bs = checkMissingBuildScript(files);
    if (bs) findings.push(bs);

    const mf = checkMalformedPackageJson(files);
    if (mf) findings.push(mf);

    const dd = checkDuplicateDependencies(files);
    if (dd) findings.push(dd);

    const nv = checkNodeVersionMismatch(files, snapshot);
    if (nv) findings.push(nv);
  }

  // Log-based checks
  if (log && log.matchedSignals.length > 0) {
    const logFindings = findingsFromSignals(log.matchedSignals, log);
    findings.push(...logFindings);
  }

  // Limit and rank
  return rankFindings(findings).slice(0, LIMITS.FINDINGS_MAX);
}
