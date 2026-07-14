import { describe, it, expect } from 'vitest';
import { detectProject } from '@/lib/detect-project';
import type { GitHubFile } from '@/lib/github/client';

function makeFile(path: string, content: string): GitHubFile {
  return { path, content, size: content.length };
}

describe('detectProject', () => {
  describe('package manager detection', () => {
    it('detects pnpm from pnpm-lock.yaml', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test' })),
        makeFile('pnpm-lock.yaml', 'lockfileVersion: 6\n'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.packageManager).toBe('pnpm');
    });

    it('detects yarn from yarn.lock (classic)', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test' })),
        makeFile('yarn.lock', '# yarn lockfile v1\nreact@^18:\n  version "18.0.0"\n'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.packageManager).toBe('yarn');
      expect(snapshot.packageManagerVersion).toBe('1');
    });

    it('detects bun from bun.lock', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test' })),
        makeFile('bun.lock', 'bun-lockfile-format: 1\n'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.packageManager).toBe('bun');
    });

    it('detects npm from package-lock.json', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test' })),
        makeFile('package-lock.json', JSON.stringify({ lockfileVersion: 3 })),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.packageManager).toBe('npm');
    });

    it('detects package manager from packageManager field', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test', packageManager: 'pnpm@8.1.0' })),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.packageManager).toBe('pnpm');
    });
  });

  describe('framework detection', () => {
    it('detects Next.js from next.config.js', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test', dependencies: { next: '^15.0.0' } })),
        makeFile('next.config.js', 'module.exports = {}'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.framework).toBe('Next.js');
    });

    it('detects Next.js from next dependency', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test', dependencies: { next: '^15.0.0', react: '^19.0.0' } })),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.framework).toBe('Next.js');
    });

    it('detects Vite React from vite.config.js', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test', dependencies: { react: '^18.0.0' } })),
        makeFile('vite.config.js', 'import { defineConfig } from "vite";\nexport default defineConfig({});'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.framework).toBe('React (Vite)');
    });

    it('detects Vue with Vite', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test', dependencies: { vue: '^3.0.0' } })),
        makeFile('vite.config.js', 'import vue from "@vitejs/plugin-vue"'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.framework).toBe('Vue (Vite)');
    });
  });

  describe('monorepo detection', () => {
    it('detects monorepo from turbo.json', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'root' })),
        makeFile('turbo.json', '{"$schema": "https://turbo.build/schema.json"}'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.isMonorepo).toBe(true);
    });

    it('detects monorepo from workspaces field', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'root', workspaces: ['packages/*'] })),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.isMonorepo).toBe(true);
    });
  });

  describe('Node version detection', () => {
    it('extracts from .nvmrc', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test' })),
        makeFile('.nvmrc', '20.11.0\n'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.nodeVersionRequirement).toBe('20.11.0');
    });

    it('extracts from package.json engines', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test', engines: { node: '>=20.0.0' } })),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.nodeVersionRequirement).toBe('>=20.0.0');
    });
  });

  describe('build script detection', () => {
    it('extracts build command', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ scripts: { build: 'next build', dev: 'next dev' } })),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.buildCommand).toBe('next build');
    });
  });

  describe('lockfiles', () => {
    it('lists found lockfiles', () => {
      const files = [
        makeFile('package.json', JSON.stringify({ name: 'test' })),
        makeFile('package-lock.json', '{"lockfileVersion": 3}'),
        makeFile('yarn.lock', '# v1'),
      ];
      const snapshot = detectProject(files, 'owner/repo');
      expect(snapshot.lockfiles).toContain('package-lock.json');
      expect(snapshot.lockfiles).toContain('yarn.lock');
    });
  });
});
