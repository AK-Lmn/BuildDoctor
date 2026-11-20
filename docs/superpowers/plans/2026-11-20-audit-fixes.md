# BuildDoctor Quality & Reliability Fixes Implementation Plan (Batched by Category)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all security, performance, accessibility, theming, and testing defects identified in the Ponytail and Impeccable audits, structured into 4 clean categorical batches.

**Architecture:** 
1. **Batch 1: Engine Core & Stability** (catastrophic regex ReDoS defense, client interval timer cleanup, fetch timeout and memory guards)
2. **Batch 2: Accessibility & Ergonomics** (WCAG AA contrast ratios, graceful reduced motion, touch targets and form semantics)
3. **Batch 3: Design Tokens & Lean Cleanup** (CSS custom property consistency, dead code elimination, log calculation optimizations)
4. **Batch 4: Test Coverage & Verification** (unit test suites for local directory traversal, path normalization, and overall build validation)

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Vitest, Node.js runtime.

**Spec:** Consolidated findings from `/ponytail-audit` and `/impeccable audit`.

## Global Constraints

- Never execute repository or user-supplied code.
- All secret redactions must run safely in constant/linear time with zero catastrophic backtracking.
- Strict WCAG 2.1 AA text contrast (minimum 4.5:1 for normal text).
- Responsive touch targets must satisfy minimum 24×24px with adequate spacing and reach 44×44px envelopes where practical.
- Preserve deterministic fallback capabilities for all AI interactions.

## Review Focus

1. **ReDoS exploit strings:** 200 KB logs containing repetitive unanchored base64-like strings or `Bearer ` tokens must process without blocking the event loop.
2. **Network request abortion:** An aborted client submission must immediately cancel active stage intervals and tear down in-flight GitHub fetches.
3. **Massive Git tree response:** A repo with 50,000+ tree items must not crash Node.js heap memory.
4. **Touchscreen mis-taps:** Closely spaced filter buttons and upload triggers must be easily tappable on 320px–375px mobile screens.
5. **Reduced-motion accessibility:** Toggling `prefers-reduced-motion` must retain clear, accessible UI state changes without harsh 0.01ms abrupt cuts or broken visual indications.

---

### Batch 1: Engine Core, Security & Stability

**Files:**
- Modify: `lib/redact.ts:27-77`
- Modify: `app/page.tsx:60-105`
- Modify: `lib/github/client.ts:255-318`
- Modify: `lib/config.ts:25-28`
- Test: `__tests__/redact.test.ts`
- Test: `__tests__/github-client.test.ts`

**Interfaces:**
- Produces: Safe linear-time `redactSecrets`, leak-free client request lifecycle in `HomePage`, and socket-timeout guarded `fetchRepository`.

- [ ] **Step 1: Write failing test in `__tests__/redact.test.ts` for ReDoS edge cases**

```typescript
it('redacts long base64 and bearer patterns in linear time without catastrophic backtracking', () => {
  const longPrefix = 'Bearer ' + 'a'.repeat(5000) + '!';
  const start = Date.now();
  const { redacted } = redactSecrets(longPrefix);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(100);
  expect(redacted).toContain('[REDACTED_TOKEN]');
});
```

- [ ] **Step 2: Fix ReDoS quantifiers in `lib/redact.ts`**

Bound greedy quantifiers so search space is strictly finite:
- Change `Bearer\s+[a-zA-Z0-9\-._~+/]{20,}={0,2}` to `Bearer\s+[A-Za-z0-9\-._~+/]{20,500}={0,2}`
- Change `\b[a-zA-Z0-9+/]{32,}={0,2}\b` to `\b[A-Za-z0-9+/]{32,500}={0,2}\b`

- [ ] **Step 3: Fix interval timer leak in `app/page.tsx`**

Ensure `stageInterval` is cleared in a `finally` block so request aborts or network failures never leave active background timers:
```typescript
let stageInterval: ReturnType<typeof setInterval> | null = null;
try {
  stageInterval = setInterval(...);
  // fetch ...
} finally {
  if (stageInterval) clearInterval(stageInterval);
  stopTimer();
}
```

- [ ] **Step 4: Add per-file fetch timeout in `lib/github/client.ts`**

Combine signal with `AbortSignal.timeout(LIMITS.GITHUB_FETCH_TIMEOUT_MS)`:
```typescript
const fileSignal = AbortSignal.any([signal, AbortSignal.timeout(LIMITS.GITHUB_FETCH_TIMEOUT_MS)]);
const resp = await fetch(contentUrl, { headers, signal: fileSignal });
```

- [ ] **Step 5: Run tests for Batch 1**

Run: `npx vitest run __tests__/redact.test.ts __tests__/github-client.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit Batch 1**

```bash
git add lib/redact.ts app/page.tsx lib/github/client.ts lib/config.ts __tests__/redact.test.ts
git commit -m "fix(core): secure regex against ReDoS, clean up client timers, and add socket timeouts"
```

---

### Batch 2: Accessibility, Ergonomics & Responsive Touch

**Files:**
- Modify: `app/globals.css:10-26, 85-92`
- Modify: `components/LoadingState.tsx:40-50`
- Modify: `components/ReportView.tsx:255-274`
- Modify: `components/DiagnoseForm.tsx:325-350`
- Test: `__tests__/report-view.test.tsx`

**Interfaces:**
- Produces: WCAG 2.1 AA compliant color tokens, gentle reduced-motion fallbacks, and mobile-friendly touch targets (min 36–44px).

- [ ] **Step 1: Elevate text contrast token in `app/globals.css`**

Raise `--bd-text-muted` from `#555a68` to `#8c92a4` (satisfies WCAG AA 4.5:1 against `#16181c` and `#0f0f11`).

- [ ] **Step 2: Refactor `prefers-reduced-motion` in `app/globals.css` and `components/LoadingState.tsx`**

Replace blanket `0.01ms` animation wipe with graceful reductions (disabling spins and translations while preserving opacity fades for clear state change feedback). In `components/LoadingState.tsx`, replace the inline style spin with class-based motion support.

- [ ] **Step 3: Enlarge touch envelopes for mobile controls**

- In `components/ReportView.tsx`: Increase filter button padding to `8px 12px` and set `minHeight: '36px'`.
- In `components/DiagnoseForm.tsx`: Enlarge the upload button touch boundary and link it semantically to the hidden input via `aria-controls="log-file-input"`.

- [ ] **Step 4: Run mechanical detector check**

Run: `C:\Users\kc\.gemini\config\skills\impeccable\scripts\impeccable.cmd detect --json app\globals.css components\ReportView.tsx components\DiagnoseForm.tsx components\LoadingState.tsx`
Expected: 0 rule violations.

- [ ] **Step 5: Commit Batch 2**

```bash
git add app/globals.css components/LoadingState.tsx components/ReportView.tsx components/DiagnoseForm.tsx
git commit -m "style(a11y): elevate text contrast, fix reduced-motion rules, and enlarge touch targets"
```

---

### Batch 3: Design Tokens, Theming & Lean Refactoring

**Files:**
- Modify: `components/DiagnoseForm.tsx:57-78`
- Modify: `components/ReportView.tsx:48-56, 285-290`
- Modify: `lib/github/url-parser.ts:79-83`
- Modify: `lib/log-normalizer.ts:88-135`
- Test: `__tests__/github-url.test.ts`
- Test: `__tests__/log-normalizer.test.ts`

**Interfaces:**
- Produces: Consistent CSS token consumption (`var(--bd-*)`), lean log length tracking, and clean URL validation without dead branches.

- [ ] **Step 1: Replace hardcoded inline colors with CSS tokens**

In `DiagnoseForm.tsx` and `ReportView.tsx`, swap raw `#16181c`, `#2a2d35`, `#f59e0b` literals in container and card styles to `var(--bd-bg-surface)`, `var(--bd-border)`, and `var(--bd-amber)`.

- [ ] **Step 2: Delete redundant hostname check in `lib/github/url-parser.ts`**

Remove duplicate `if (parsed.hostname !== 'github.com')` check (lines 79–83).

- [ ] **Step 3: Streamline log length calculation in `lib/log-normalizer.ts`**

Track character lengths with an integer accumulator during loop iterations rather than repeatedly calling `collapsedLines.join('\n').length`.

- [ ] **Step 4: Run unit tests for Batch 3**

Run: `npx vitest run __tests__/github-url.test.ts __tests__/log-normalizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Batch 3**

```bash
git add components/DiagnoseForm.tsx components/ReportView.tsx lib/github/url-parser.ts lib/log-normalizer.ts
git commit -m "refactor(theming): bind components to CSS tokens and eliminate redundant logic"
```

---

### Batch 4: Test Coverage & Verification

**Files:**
- Create: `__tests__/analyzer-directory.test.ts`
- Modify: `lib/analyzer.ts`

**Interfaces:**
- Produces: Complete automated test coverage for local directory traversal, ignore rules, and error handling.

- [ ] **Step 1: Write test suite for `readDirectoryAsFiles` in `__tests__/analyzer-directory.test.ts`**

Test scenarios:
1. Omits ignored directories (`node_modules`, `.git`, `.next`).
2. Reads top-level configuration files (`package.json`, `tsconfig.json`).
3. Handles non-existent directories gracefully without throwing unhandled exceptions.
4. Normalizes Windows backslashes to standard forward slashes.

- [ ] **Step 2: Run all test suites across the project**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit Batch 4**

```bash
git add __tests__/analyzer-directory.test.ts lib/analyzer.ts
git commit -m "test: add comprehensive test suite for local directory analyzer"
```
