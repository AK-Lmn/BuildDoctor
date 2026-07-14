/**
 * Project detection — derives a typed snapshot from fetched repository files.
 */

import type { GitHubFile } from './github/client';
import type { ProjectSnapshot } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function findFile(files: GitHubFile[], ...names: string[]): GitHubFile | undefined {
  for (const name of names) {
    const found = files.find(f => {
      const base = f.path.split('/').pop()!;
      return base === name || f.path === name;
    });
    if (found) return found;
  }
  return undefined;
}

function parseJsonSafe(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Package manager detection ─────────────────────────────────────────────────

function detectPackageManager(files: GitHubFile[]): { name: string; version?: string } {
  const lockfiles = files.map(f => f.path.split('/').pop()!);

  if (lockfiles.includes('bun.lock') || lockfiles.includes('bun.lockb')) return { name: 'bun' };
  if (lockfiles.includes('pnpm-lock.yaml')) return { name: 'pnpm' };
  if (lockfiles.includes('yarn.lock')) {
    // Detect yarn version from lock content
    const yarnLock = files.find(f => f.path.endsWith('yarn.lock'));
    if (yarnLock?.content.includes('__metadata')) return { name: 'yarn', version: '3+' };
    return { name: 'yarn', version: '1' };
  }
  if (lockfiles.includes('package-lock.json') || lockfiles.includes('npm-shrinkwrap.json')) {
    // Detect npm version from lockfile version field
    const lockfile = files.find(f => f.path.endsWith('package-lock.json'));
    if (lockfile) {
      const parsed = parseJsonSafe(lockfile.content) as { lockfileVersion?: number } | null;
      if (parsed?.lockfileVersion === 3) return { name: 'npm', version: '7+' };
      if (parsed?.lockfileVersion === 2) return { name: 'npm', version: '7+' };
    }
    return { name: 'npm' };
  }

  // Check package.json for packageManager field
  const pkgFile = findFile(files, 'package.json');
  if (pkgFile) {
    const pkg = parseJsonSafe(pkgFile.content) as { packageManager?: string } | null;
    if (pkg?.packageManager) {
      if (pkg.packageManager.startsWith('pnpm')) return { name: 'pnpm', version: pkg.packageManager.split('@')[1] };
      if (pkg.packageManager.startsWith('yarn')) return { name: 'yarn', version: pkg.packageManager.split('@')[1] };
      if (pkg.packageManager.startsWith('bun')) return { name: 'bun', version: pkg.packageManager.split('@')[1] };
      if (pkg.packageManager.startsWith('npm')) return { name: 'npm', version: pkg.packageManager.split('@')[1] };
    }
  }

  return { name: 'npm' };
}

// ── Framework detection ───────────────────────────────────────────────────────

function detectFramework(files: GitHubFile[], deps: Record<string, string>): string {
  // Detect from config files first
  if (findFile(files, 'next.config.js', 'next.config.mjs', 'next.config.ts')) return 'Next.js';

  // Check vite before React to distinguish SPA React
  if (findFile(files, 'vite.config.js', 'vite.config.ts')) {
    if ('vue' in deps) return 'Vue (Vite)';
    if ('svelte' in deps || '@sveltejs/kit' in deps) return 'SvelteKit';
    if ('astro' in deps) return 'Astro';
    return 'React (Vite)';
  }

  // Dependency-based detection
  if ('next' in deps) return 'Next.js';
  if ('nuxt' in deps || 'nuxt3' in deps) return 'Nuxt';
  if ('@sveltejs/kit' in deps) return 'SvelteKit';
  if ('astro' in deps) return 'Astro';
  if ('@remix-run/node' in deps || '@remix-run/react' in deps) return 'Remix';
  if ('@react-router/node' in deps) return 'React Router (Framework)';
  if ('express' in deps) return 'Express';
  if ('fastify' in deps) return 'Fastify';
  if ('vue' in deps) return 'Vue';
  if ('react' in deps) return 'React';
  if ('svelte' in deps) return 'Svelte';

  return 'Node.js';
}

// ── Node version ──────────────────────────────────────────────────────────────

function detectNodeVersion(files: GitHubFile[], pkg: Record<string, unknown> | null): string | undefined {
  const nvmrc = findFile(files, '.nvmrc');
  if (nvmrc) return nvmrc.content.trim();

  const nodeVersion = findFile(files, '.node-version');
  if (nodeVersion) return nodeVersion.content.trim();

  if (pkg?.engines && typeof pkg.engines === 'object') {
    const engines = pkg.engines as Record<string, string>;
    if (engines.node) return engines.node;
  }

  return undefined;
}

// ── Path aliases ──────────────────────────────────────────────────────────────

function detectPathAliases(files: GitHubFile[]): Record<string, string[]> | undefined {
  const tsconfig = findFile(files, 'tsconfig.json');
  if (!tsconfig) return undefined;

  const parsed = parseJsonSafe(tsconfig.content) as {
    compilerOptions?: { paths?: Record<string, string[]> };
  } | null;

  return parsed?.compilerOptions?.paths ?? undefined;
}

// ── Environment variables ─────────────────────────────────────────────────────

function detectEnvVars(files: GitHubFile[]): string[] {
  const envVars = new Set<string>();
  const envVarRe = /process\.env\.([A-Z_][A-Z0-9_]+)/g;
  const nextEnvRe = /NEXT_PUBLIC_[A-Z_][A-Z0-9_]*/g;

  for (const file of files) {
    if (file.path.endsWith('.env') || file.path.endsWith('.env.example')) continue;
    let m: RegExpExecArray | null;
    while ((m = envVarRe.exec(file.content)) !== null) {
      envVars.add(m[1]);
    }
    while ((m = nextEnvRe.exec(file.content)) !== null) {
      envVars.add(m[0]);
    }
  }

  return [...envVars];
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function detectProject(
  files: GitHubFile[],
  repositoryName: string,
  selectedRef?: string
): ProjectSnapshot {
  const pkgFile = findFile(files, 'package.json');
  const pkg = pkgFile ? parseJsonSafe(pkgFile.content) : null;

  const allDeps: Record<string, string> = {
    ...(typeof pkg?.dependencies === 'object' && pkg.dependencies ? pkg.dependencies as Record<string, string> : {}),
    ...(typeof pkg?.devDependencies === 'object' && pkg.devDependencies ? pkg.devDependencies as Record<string, string> : {}),
  };

  const pm = detectPackageManager(files);
  const framework = detectFramework(files, allDeps);
  const nodeVersion = detectNodeVersion(files, pkg);
  const pathAliases = detectPathAliases(files);
  const envVarsReferenced = detectEnvVars(files);

  // Lockfiles present
  const lockfiles = files
    .map(f => f.path.split('/').pop()!)
    .filter(name => ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'npm-shrinkwrap.json'].includes(name));

  // Is monorepo?
  const isMonorepo = !!(
    (pkg as Record<string, unknown> | null)?.workspaces ||
    findFile(files, 'turbo.json') ||
    findFile(files, 'nx.json') ||
    files.some(f => /packages\/[^/]+\/package\.json/.test(f.path))
  );

  // Workspace packages
  const workspacePackages = files
    .filter(f => /packages\/[^/]+\/package\.json$/.test(f.path))
    .map(f => f.path.replace('/package.json', '').split('/').pop()!);

  // Scripts
  const scripts = (pkg as { scripts?: Record<string, string> } | null)?.scripts ?? {};
  const buildCommand = scripts.build;
  const devCommand = scripts.dev ?? scripts.start;
  const testCommand = scripts.test;
  const lintCommand = scripts.lint;

  // Config files found
  const configFilesFound = files
    .filter(f => {
      const name = f.path.split('/').pop()!;
      return [
        'package.json', 'tsconfig.json', 'next.config.js', 'next.config.mjs', 'next.config.ts',
        'vite.config.js', 'vite.config.ts', 'vercel.json', 'netlify.toml', 'turbo.json',
        '.npmrc', '.nvmrc', '.node-version',
      ].includes(name);
    })
    .map(f => f.path);

  // Relevant deps (for diagnosis)
  const RELEVANT_PKGS = ['next', 'react', 'react-dom', 'typescript', 'vite', 'vue', 'svelte', 'astro', 'nuxt'];
  const relevantDependencies: Record<string, string> = {};
  for (const pkg of RELEVANT_PKGS) {
    if (allDeps[pkg]) relevantDependencies[pkg] = allDeps[pkg];
  }

  // Deployment config
  let deploymentConfig: string | undefined;
  if (findFile(files, 'vercel.json')) deploymentConfig = 'Vercel';
  else if (findFile(files, 'netlify.toml')) deploymentConfig = 'Netlify';
  else if (files.some(f => f.path.startsWith('.github/workflows/'))) deploymentConfig = 'GitHub Actions';

  return {
    repositoryName,
    selectedRef,
    primaryLanguage: 'TypeScript' in allDeps || files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))
      ? 'TypeScript'
      : 'JavaScript',
    framework,
    packageManager: pm.name,
    packageManagerVersion: pm.version,
    buildCommand,
    devCommand,
    testCommand,
    lintCommand,
    nodeVersionRequirement: nodeVersion,
    typescriptUsage: files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx')),
    isMonorepo,
    workspacePackages: workspacePackages.length > 0 ? workspacePackages : undefined,
    deploymentConfig,
    lockfiles,
    pathAliases,
    envVarsReferenced: envVarsReferenced.length > 0 ? envVarsReferenced : undefined,
    configFilesFound,
    relevantDependencies,
  };
}
