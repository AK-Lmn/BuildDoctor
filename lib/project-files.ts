import type { GitHubFile } from './github/client';

const NON_PROJECT_DIRS = new Set(['test', 'tests', 'e2e', 'fixtures', 'examples', 'benchmark', 'benchmarks', 'bench', 'docs', 'codemods']);
export const isNonProjectPath = (path: string) => path.split('/').some(part => NON_PROJECT_DIRS.has(part.toLowerCase()));
export const rootFile = (files: GitHubFile[], name: string) => files.find(file => file.path === name);
export function workspacePatterns(pkg: Record<string, unknown> | null): string[] {
  const workspaces = pkg?.workspaces;
  if (Array.isArray(workspaces)) return workspaces.filter((value): value is string => typeof value === 'string');
  const packages = workspaces && typeof workspaces === 'object' ? (workspaces as { packages?: unknown }).packages : undefined;
  return Array.isArray(packages) ? packages.filter((value): value is string => typeof value === 'string') : [];
}
export function isDeclaredWorkspacePackage(path: string, patterns: string[]): boolean {
  if (!path.endsWith('/package.json') || isNonProjectPath(path)) return false;
  const dir = path.slice(0, -'/package.json'.length);
  return patterns.some(pattern => new RegExp('^' + pattern.split('*').map(escape).join('[^/]+') + '$').test(dir));
}
function escape(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
