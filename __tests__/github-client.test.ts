import { describe, it, expect } from 'vitest';
import { shouldFetchFile } from '@/lib/github/client';
import type { GitHubTreeItem } from '@/lib/github/client';

function makeItem(path: string, size?: number, type: 'blob' | 'tree' = 'blob'): GitHubTreeItem {
  return { path, type, size, sha: 'abc123', url: `https://api.github.com/repos/test/repo/git/blobs/abc123` };
}

describe('shouldFetchFile', () => {
  const referencedFiles = new Set<string>();

  it('allows package.json', () => {
    expect(shouldFetchFile(makeItem('package.json'), referencedFiles)).toBe(true);
  });

  it('allows tsconfig.json', () => {
    expect(shouldFetchFile(makeItem('tsconfig.json'), referencedFiles)).toBe(true);
  });

  it('allows next.config.ts', () => {
    expect(shouldFetchFile(makeItem('next.config.ts'), referencedFiles)).toBe(true);
  });

  it('allows vercel.json', () => {
    expect(shouldFetchFile(makeItem('vercel.json'), referencedFiles)).toBe(true);
  });

  it('allows .nvmrc', () => {
    expect(shouldFetchFile(makeItem('.nvmrc'), referencedFiles)).toBe(true);
  });

  it('allows GitHub workflow YAML', () => {
    expect(shouldFetchFile(makeItem('.github/workflows/ci.yml'), referencedFiles)).toBe(true);
  });

  it('blocks node_modules', () => {
    expect(shouldFetchFile(makeItem('node_modules/react/index.js'), referencedFiles)).toBe(false);
  });

  it('blocks .next directory', () => {
    expect(shouldFetchFile(makeItem('.next/server/app-router.js'), referencedFiles)).toBe(false);
  });

  it('blocks .env files', () => {
    expect(shouldFetchFile(makeItem('.env'), referencedFiles)).toBe(false);
    expect(shouldFetchFile(makeItem('.env.local'), referencedFiles)).toBe(false);
    expect(shouldFetchFile(makeItem('.env.production'), referencedFiles)).toBe(false);
  });

  it('blocks binary image files', () => {
    expect(shouldFetchFile(makeItem('public/logo.png'), referencedFiles)).toBe(false);
    expect(shouldFetchFile(makeItem('assets/image.jpg'), referencedFiles)).toBe(false);
  });

  it('blocks binary font files', () => {
    expect(shouldFetchFile(makeItem('fonts/Inter.woff2'), referencedFiles)).toBe(false);
  });

  it('blocks dist directory', () => {
    expect(shouldFetchFile(makeItem('dist/bundle.js'), referencedFiles)).toBe(false);
  });

  it('blocks files larger than individual limit', () => {
    expect(shouldFetchFile(makeItem('big-file.ts', 200_000), referencedFiles)).toBe(false);
  });

  it('allows files referenced by errors', () => {
    const referenced = new Set(['src/components/MyComponent.tsx']);
    expect(shouldFetchFile(makeItem('src/components/MyComponent.tsx', 5000), referenced)).toBe(true);
  });

  it('blocks tree entries (directories)', () => {
    expect(shouldFetchFile(makeItem('src', undefined, 'tree'), referencedFiles)).toBe(false);
  });

  it('blocks bun binary lockfile', () => {
    expect(shouldFetchFile(makeItem('bun.lockb'), referencedFiles)).toBe(false);
  });
});
