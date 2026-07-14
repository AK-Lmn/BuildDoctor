# BuildDoctor

**Turn build failures into a fix plan.**

BuildDoctor is a build-failure diagnostic tool for JavaScript and TypeScript web projects. It inspects your public GitHub repository, analyzes build logs, and produces an evidence-backed repair plan — without ever executing your code.

---

## The Problem

Build failures in modern JavaScript/TypeScript projects are cryptic. A single error like `Module not found: Can't resolve '@/components/Header'` may require checking `tsconfig.json` path aliases, file system casing, import paths, and framework configuration simultaneously. BuildDoctor automates this inspection.

## MVP Goal

Provide a fast, safe, static-analysis diagnostic assistant that:
1. Reads selected configuration files from public GitHub repositories
2. Normalizes and analyzes build logs
3. Identifies the most likely root cause using deterministic rules and optional AI synthesis
4. Produces a structured repair plan with evidence

---

## Features

- **Mode A — Repository + Log**: Provide a GitHub URL and build log for full diagnosis
- **Mode B — Log Only**: Paste a log for pattern-based analysis without repository access
- **Deterministic engine**: Rule-based analysis runs before AI synthesis
- **AI-assisted synthesis**: Gemini structured output produces a validated diagnosis report
- **Evidence validation**: All cited files and log lines are verified before inclusion
- **Secret redaction**: Secrets are redacted before any AI processing
- **Markdown and JSON export**: Copy or download your report
- **Mobile-first UI**: Responsive at 320px–1440px

---

## Architecture

```
POST /api/diagnose
     │
     ├─ Input validation (Zod)
     ├─ Log normalization (ANSI strip, CRLF, truncation, redaction)
     ├─ GitHub URL parsing (validation, owner/repo extraction)
     ├─ GitHub API (metadata → tree → allowlisted file fetch)
     ├─ Project detection (framework, PM, Node version, aliases)
     ├─ Deterministic diagnostics (pattern matching, rule checks)
     ├─ Gemini structured output (validated via Zod)
     ├─ Evidence validation (file existence, log line bounds)
     └─ Safe API response (no secrets, no internal errors)
```

### Deterministic-First Analysis Pipeline

1. Log normalization runs first — ANSI codes stripped, secrets redacted, signals extracted
2. Repository files fetched conservatively (allowlist + limits)
3. Project snapshot derived from fetched files
4. Deterministic findings generated from patterns and static checks
5. Gemini receives only: redacted log excerpts, project snapshot, deterministic findings, selected files
6. Gemini response validated with Zod schema
7. Evidence references validated (file existence, log line bounds)
8. Deterministic fallback used if AI fails validation

---

## GitHub API Integration

- Uses GitHub REST API v2022-11-28
- Fetches: repository metadata → recursive tree → allowlisted files only
- File limits: max 50 files, max 150 KB per file, max 600 KB total content
- Rate-limit headers parsed and surfaced to users
- `GITHUB_TOKEN` is optional — public rate limit (60 req/hr) applies without it
- Token never exposed in responses, logs, or HTML

### Allowlisted Files

Configuration: `package.json`, `tsconfig.json`, `next.config.*`, `vite.config.*`, `.nvmrc`, `vercel.json`, `netlify.toml`, and more.

Blocked: `.env*`, images, fonts, archives, `node_modules/`, `.next/`, `dist/`, binary files.

---

## Gemini Structured Output

- Model: `gemini-2.5-flash` (configurable via `GEMINI_MODEL` constant)
- SDK: `@google/genai` (current official SDK)
- Output validated with Zod schema
- One repair attempt on validation failure
- Falls back to deterministic report on AI failure
- Missing key → deterministic report with notice

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Required for AI | Gemini Developer API key from Google AI Studio |
| `GITHUB_TOKEN` | Optional | GitHub PAT for higher rate limits (5000 req/hr) |

**Never use `NEXT_PUBLIC_` prefix for these.** Both are server-only.

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
# Edit .env.local and add your keys
```

---

## Setup

```bash
# Clone
git clone https://github.com/AK-Lmn/BuildDoctor.git
cd BuildDoctor

# Install
npm install

# Configure
cp .env.example .env.local
# Add GEMINI_API_KEY (required for AI synthesis)
# Add GITHUB_TOKEN (optional, improves rate limits)

# Develop
npm run dev
```

---

## Development

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run typecheck  # TypeScript check
npm run lint     # ESLint
npm test         # Run tests (watch mode)
npm run test:run # Run tests once
```

---

## Testing

Uses Vitest + React Testing Library. All tests are fully mocked — no external API calls.

```bash
npm run test:run
```

Test suites:
- `github-url.test.ts` — URL validation and parsing
- `github-client.test.ts` — File filter allowlist/blocklist
- `redact.test.ts` — Secret redaction patterns
- `log-normalizer.test.ts` — Log processing pipeline
- `detect-project.test.ts` — Framework/PM/Node detection
- `diagnostics.test.ts` — Deterministic finding engine
- `report.test.ts` — Schema validation and exports
- `integration.test.ts` — Full pipeline without external calls

---

## Vercel Deployment

1. Connect the repository to Vercel
2. Set environment variables in Vercel project settings:
   - `GEMINI_API_KEY` (required)
   - `GITHUB_TOKEN` (optional)
3. Deploy

The `/api/diagnose` route uses `runtime = 'nodejs'` and `maxDuration = 60`.

> **Public deployments** should add platform-level rate limiting (Vercel WAF, Upstash, or similar). BuildDoctor's server-side limits protect against oversized requests but do not prevent coordinated abuse.

---

## Favicon and Manifest

- `app/icon.svg` — scalable SVG favicon (terminal + pulse + checkmark)
- `app/manifest.ts` — Web App Manifest with amber theme color
- Apple touch icon declared in layout
- Theme color: `#f59e0b` (amber)
- Background color: `#0f0f11` (near-black)

---

## Mobile Support

Tested at: 320×568, 360×800, 375×812, 390×844, 430×932.

- No page-level horizontal overflow
- Flex/grid children can shrink
- Log and code panels scroll horizontally only within their containers
- Report cards stack vertically on mobile

---

## Repository Inspection Limits

| Limit | Value |
|---|---|
| Max files fetched | 50 |
| Max individual file | 150 KB |
| Max total content | 600 KB |
| Max concurrent fetches | 5 |

---

## Log Limits

| Limit | Value |
|---|---|
| Max build log (text) | 200,000 chars |
| Max log upload | 500 KB |
| Max evidence items | 30 |
| Max findings | 12 |
| Max patches | 8 |

---

## Secret Redaction

BuildDoctor redacts likely secrets before sending content to Gemini:

- GitHub tokens (ghp_, ghs_, gho_, ghr_, github_pat_)
- JWTs (eyJ...)
- AWS access keys (AKIA...)
- Bearer tokens in authorization headers
- Database connection strings
- Private key PEM blocks
- Sensitive query parameters (token, api_key, secret, password, auth, code, signature)
- Long hex strings (40+ chars)
- Environment variable assignments with secret-like values

> Automatic redaction reduces risk but is **not guaranteed** to detect every secret. Users should remove sensitive data before submitting.

---

## Privacy Behavior

- BuildDoctor fetches selected text files from **public** GitHub repositories only
- Supplied logs and selected repository content are processed server-side
- Gemini may receive **redacted excerpts** for diagnosis
- BuildDoctor does **not intentionally persist** report history (stateless server)
- BuildDoctor does **not run repository code**
- Users should not submit private credentials or sensitive source code
- Patches are suggestions and must be reviewed

---

## Known Limitations

- Only public GitHub repositories are supported (no private repos, no GitHub Enterprise)
- Repository code is **never executed** — diagnosis is static analysis only
- No fixes are automatically applied
- AI recommendations may be incorrect — all patches require review
- TypeScript resolution is approximated, not exact
- File casing detection is limited without local filesystem access
- GitHub API rate limits apply: 60 req/hr unauthenticated, 5000/hr with token

---

## Future Improvements

- **Isolated build execution**: Run builds in a sandboxed environment (Firecracker, WASM) to verify suggested fixes — explicitly out of scope for this MVP
- Private repository support (OAuth flow)
- GitHub Enterprise support
- Historical report storage
- Shareable report links
- CI integration (GitHub Actions comment bot)

---

## Provider Rate Limits

- **GitHub API**: 60 req/hr unauthenticated, 5000/hr with `GITHUB_TOKEN`
- **Gemini**: Subject to your API key's quota. See [Google AI Studio](https://aistudio.google.com/) for limits.

---

## Authorized Use

BuildDoctor is a diagnostic assistant. It:
- Reads public repositories only
- Does not execute code
- Does not write to repositories
- Does not create commits or pull requests
- Does not guarantee that suggested fixes work

BuildDoctor is not a security scanner, vulnerability scanner, or malware analysis tool.
