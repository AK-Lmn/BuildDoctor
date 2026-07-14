import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from '@/lib/github/url-parser';

describe('parseGitHubUrl', () => {
  describe('valid URLs', () => {
    it('parses a canonical repo URL', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', ref: undefined });
    });

    it('strips .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', ref: undefined });
    });

    it('extracts ref from tree URL', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/main');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', ref: 'main' });
    });

    it('extracts multi-segment ref', () => {
      const result = parseGitHubUrl('https://github.com/owner/repo/tree/feature/my-branch');
      expect(result).toEqual({ owner: 'owner', repo: 'repo', ref: 'feature/my-branch' });
    });

    it('accepts hyphens and dots in names', () => {
      const result = parseGitHubUrl('https://github.com/my-org/my.repo');
      expect(result).toEqual({ owner: 'my-org', repo: 'my.repo', ref: undefined });
    });
  });

  describe('rejections', () => {
    it('rejects non-GitHub hosts', () => {
      expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow();
    });

    it('rejects embedded credentials', () => {
      expect(() => parseGitHubUrl('https://user:token@github.com/owner/repo')).toThrow(/credentials/i);
    });

    it('rejects issue URLs', () => {
      expect(() => parseGitHubUrl('https://github.com/owner/repo/issues/123')).toThrow();
    });

    it('rejects pull request URLs', () => {
      expect(() => parseGitHubUrl('https://github.com/owner/repo/pulls/456')).toThrow();
    });

    it('rejects settings URLs', () => {
      expect(() => parseGitHubUrl('https://github.com/owner/repo/settings')).toThrow();
    });

    it('rejects actions URLs', () => {
      expect(() => parseGitHubUrl('https://github.com/owner/repo/actions')).toThrow();
    });

    it('rejects URLs with token query param', () => {
      expect(() => parseGitHubUrl('https://github.com/owner/repo?token=secret')).toThrow(/authentication/i);
    });

    it('rejects URLs with api_key query param', () => {
      expect(() => parseGitHubUrl('https://github.com/owner/repo?api_key=secret')).toThrow();
    });

    it('rejects too-short paths', () => {
      expect(() => parseGitHubUrl('https://github.com/owner')).toThrow();
    });

    it('rejects empty string', () => {
      expect(() => parseGitHubUrl('')).toThrow(/required/i);
    });

    it('rejects javascript: protocol', () => {
      expect(() => parseGitHubUrl('javascript:alert(1)')).toThrow();
    });

    it('rejects data: protocol', () => {
      expect(() => parseGitHubUrl('data:text/html,<h1>xss</h1>')).toThrow();
    });

    it('rejects malformed URLs', () => {
      expect(() => parseGitHubUrl('not-a-url')).toThrow();
    });
  });
});
