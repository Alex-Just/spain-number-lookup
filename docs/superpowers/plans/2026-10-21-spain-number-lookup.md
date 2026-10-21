# Spain Number Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal English PWA + free Cloudflare Worker that accepts a shared/pasted Spain phone number and returns one aggregated lookup result from free Spanish sources.

**Architecture:** Static PWA (manifest + Web Share Target) talks to a same-origin Cloudflare Worker `/api/lookup`. The Worker normalizes the number, fans out free source adapters with timeouts, merges a summary, and returns JSON. Adapters isolate fragile HTML/JSON parsing.

**Tech Stack:** TypeScript, Cloudflare Workers (+ static assets), Vitest, Wrangler.

**Spec:** `docs/superpowers/specs/2026-10-21-spain-number-lookup-design.md`

## Global Constraints

- Deploy from this repository on Cloudflare free tier (`*.workers.dev` / `*.pages.dev`).
- UI language English; keep Spanish source strings as returned.
- No paid APIs; no contact upload; no call blocking; no StoryCheck/ClarityCheck in v1.
- Accept Spain national 9-digit numbers starting with `4–9` (includes `400…`); do not reject non-6/7/8/9 prefixes.
- Public `/api/lookup` with per-IP rate limits; no login in v1.
- Share: `text/plain` + `text/*` (+ optional URL); extract Truecaller-style text, bare/`+34`/`tel:`; no vCard.
- Multiple numbers: prefer number from Truecaller-like search URL in the same text; else first Spain candidate.
- Overall lookup budget ~8–15s; honest `found` / `empty` / `failed` / `blocked` per source.
- No magic numbers/strings in code — use named constants.

## Review Focus

- Shared Truecaller text with number + URL → extracts the Spain number from the URL path when present.
- Number `400300429` / `+34400300429` → accepted (not rejected as “invalid Spain”).
- ListaSpam HTTP 403 → source status `blocked`, deep link still returned, lookup still succeeds overall.
- ResponderONo HTTP 404 → source status `empty`, not `failed`.
- All sources empty/failed → `summary.confidence` is `none` and headline states no useful matches (no invented identity).

---

## File Structure

```text
spain-number-lookup/
  package.json
  wrangler.toml
  tsconfig.json
  vitest.config.ts
  src/
    types.ts                 # LookupResult, SourceResult, Confidence
    constants.ts             # timeouts, rate limits, source IDs, regex bits
    normalize.ts             # extract + normalize Spain numbers
    summary.ts               # merge SourceResult[] → summary
    rate-limit.ts            # in-memory per-IP limiter for Worker isolate
    lookup.ts                # orchestrate adapters
    worker.ts                # fetch handler: /api/lookup + asset fallback
    sources/
      types.ts               # SourceAdapter interface
      tellows.ts
      teledigo.ts
      listaspam.ts
      responderono.ts
      openspam.ts
      quienhallamado.ts
      truecaller.ts
      index.ts               # ordered adapter list + deep-link helpers
  public/
    index.html
    app.js
    styles.css
    manifest.webmanifest
    sw.js
    icons/icon-192.png       # simple generated placeholder OK
  tests/
    normalize.test.ts
    summary.test.ts
    tellows.test.ts
    teledigo.test.ts
    listaspam.test.ts
    fixtures/                # saved HTML/JSON snippets
  README.md
```

---

### Task 1: Project scaffold and shared types

**Files:**
- Create: `package.json`, `wrangler.toml`, `tsconfig.json`, `vitest.config.ts`, `src/types.ts`, `src/constants.ts`, `src/sources/types.ts`
- Test: none yet (types/constants only; verified by `npm test` empty pass or typecheck)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `Confidence = 'high' | 'medium' | 'low' | 'none'`
  - `SourceStatus = 'found' | 'empty' | 'failed' | 'blocked'`
  - `SourceResult = { id: string; name: string; status: SourceStatus; label?: string; detail?: string; score?: number; url: string }`
  - `LookupSummary = { headline: string; confidence: Confidence; notes: string[] }`
  - `LookupResult = { numberE164: string; numberNational: string; summary: LookupSummary; sources: SourceResult[] }`
  - `SourceAdapter = { id: string; name: string; buildUrl(national9: string): string; lookup(national9: string, signal: AbortSignal): Promise<SourceResult> }`
  - Constants: `SPAIN_COUNTRY_CODE`, `LOOKUP_OVERALL_TIMEOUT_MS`, `SOURCE_TIMEOUT_MS`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, ordered `SOURCE_IDS`

- [ ] **Step 1: Create package with scripts `test`, `dev`, `deploy` and deps** (`wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`)

- [ ] **Step 2: Add `wrangler.toml` Worker name `spain-number-lookup`, `main = src/worker.ts`, `assets = { directory = "./public" }`**

- [ ] **Step 3: Add `src/types.ts`, `src/constants.ts`, `src/sources/types.ts` with the interfaces above**

- [ ] **Step 4: Commit**

```bash
git init  # if needed
git add package.json wrangler.toml tsconfig.json vitest.config.ts src/types.ts src/constants.ts src/sources/types.ts
git commit -m "chore: scaffold Worker project and shared lookup types"
```

---

### Task 2: Number extraction and normalization

**Files:**
- Create: `src/normalize.ts`
- Test: `tests/normalize.test.ts`

**Interfaces:**
- Consumes: constants for Spain country code / digit rules
- Produces:
  - `extractSpainNumber(raw: string): { numberE164: string; numberNational: string } | null`
  - Prefer Truecaller-like `/search/es/{digits}` (or path ending in 9+ digits after country) over first loose match when both exist

- [ ] **Step 1: Write failing tests in `tests/normalize.test.ts`**

```ts
// test_extracts_from_truecaller_share_text
expect(extractSpainNumber('+34400300429\nhttps://truecaller.com/search/es/34400300429\nsent using Truecaller'))
  .toEqual({ numberE164: '+34400300429', numberNational: '400300429' })

// test_accepts_400_prefix
expect(extractSpainNumber('400 30 04 29'))
  .toEqual({ numberE164: '+34400300429', numberNational: '400300429' })

// test_accepts_tel_uri
expect(extractSpainNumber('tel:+34-400-300-429'))
  .toEqual({ numberE164: '+34400300429', numberNational: '400300429' })

// test_rejects_too_short
expect(extractSpainNumber('12345')).toBeNull()
```

- [ ] **Step 2: Run `npx vitest run tests/normalize.test.ts` — expect FAIL (module missing)**

- [ ] **Step 3: Implement `extractSpainNumber` in `src/normalize.ts`**

- [ ] **Step 4: Run `npx vitest run tests/normalize.test.ts` — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/normalize.ts tests/normalize.test.ts
git commit -m "feat: extract and normalize Spain phone numbers from share text"
```

---

### Task 3: Summary merger

**Files:**
- Create: `src/summary.ts`
- Test: `tests/summary.test.ts`

**Interfaces:**
- Consumes: `SourceResult`, `LookupSummary`
- Produces: `buildSummary(sources: SourceResult[]): LookupSummary`
- Precedence per spec: ListaSpam label → Tellows score/category → Teledigo operator → else none

- [ ] **Step 1: Write failing tests**

```ts
// test_prefers_listaspam_label
// sources: listaspam found "Llamadas comerciales", teledigo found operator
// expect headline to include Llamadas comerciales, confidence medium or high

// test_none_when_all_empty
// all empty/failed/blocked → confidence 'none', headline mentions no useful matches
```

- [ ] **Step 2: Run vitest — expect FAIL**

- [ ] **Step 3: Implement `buildSummary`**

- [ ] **Step 4: Run vitest — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/summary.ts tests/summary.test.ts
git commit -m "feat: merge source results into English summary with confidence"
```

---

### Task 4: Source adapters (fixtures)

**Files:**
- Create: `src/sources/*.ts`, `src/sources/index.ts`, `tests/fixtures/*`, `tests/tellows.test.ts`, `tests/teledigo.test.ts`, `tests/listaspam.test.ts`
- Each adapter exports `lookup` + `buildUrl`; parsing may use a pure `parseXxx(body: string): Partial<SourceResult>` tested with fixtures

**Interfaces:**
- Consumes: `SourceAdapter`, `SOURCE_TIMEOUT_MS`
- Produces: ordered `adapters: SourceAdapter[]` from `src/sources/index.ts`
- Deep links exact templates from the spec

- [ ] **Step 1: Add fixtures** — minimal saved Tellows JSON (`score`, `comments`), Teledigo HTML containing “asignado a AIRE NETWORKS…”, ListaSpam HTML with “Llamadas comerciales”

- [ ] **Step 2: Write failing parse tests** for Tellows JSON score, Teledigo operator string, ListaSpam label

- [ ] **Step 3: Implement parsers + adapters** — on HTTP 403 ListaSpam → `status: 'blocked'`; ResponderONo 404 → `empty`; network/5xx → `failed`; always set `url` via `buildUrl`

- [ ] **Step 4: Implement stub/lightweight adapters** for OpenSpam, QuienHaLlamado, Truecaller (deep link + best-effort fetch; empty/failed OK)

- [ ] **Step 5: `npx vitest run tests/tellows.test.ts tests/teledigo.test.ts tests/listaspam.test.ts` — PASS**

- [ ] **Step 6: Commit**

```bash
git add src/sources tests/fixtures tests/tellows.test.ts tests/teledigo.test.ts tests/listaspam.test.ts
git commit -m "feat: add free Spain lookup source adapters with fixture tests"
```

---

### Task 5: Lookup orchestration and rate limit

**Files:**
- Create: `src/lookup.ts`, `src/rate-limit.ts`
- Test: `tests/lookup.test.ts` (mock adapters), `tests/rate-limit.test.ts`

**Interfaces:**
- Consumes: `extractSpainNumber`, `adapters`, `buildSummary`, constants
- Produces:
  - `runLookup(rawInput: string, fetchImpl?: typeof fetch): Promise<LookupResult | { error: string }>`
  - `RateLimiter.check(ip: string): boolean` — false when over `RATE_LIMIT_MAX_REQUESTS` in `RATE_LIMIT_WINDOW_MS`

- [ ] **Step 1: Write failing rate-limit test** — N+1 checks in window → last false

- [ ] **Step 2: Implement `RateLimiter`**

- [ ] **Step 3: Write failing lookup test with mock adapters** — returns merged `LookupResult`; overall abort after `LOOKUP_OVERALL_TIMEOUT_MS`

- [ ] **Step 4: Implement `runLookup`** — normalize or `{ error: 'Invalid Spain phone number' }`; `Promise.allSettled` adapters with per-source AbortSignal timeout; `buildSummary`

- [ ] **Step 5: Vitest PASS**

- [ ] **Step 6: Commit**

```bash
git add src/lookup.ts src/rate-limit.ts tests/lookup.test.ts tests/rate-limit.test.ts
git commit -m "feat: orchestrate parallel source lookup with rate limiting"
```

---

### Task 6: Worker HTTP API

**Files:**
- Create: `src/worker.ts`
- Test: optional `tests/worker.test.ts` with `export default { fetch }` unit using Request/Response (if easy); else manual `wrangler dev` check listed below

**Interfaces:**
- Consumes: `runLookup`, `RateLimiter`
- Produces: Worker `fetch(request, env, ctx)`
  - `GET /api/lookup?number=` or `POST /api/lookup` JSON `{ number: string }`
  - `200` + `LookupResult` JSON
  - `400` invalid number
  - `429` rate limited
  - Static assets for other paths via Workers assets binding

- [ ] **Step 1: Implement `src/worker.ts` routing and JSON responses (`content-type: application/json`)**

- [ ] **Step 2: Run `npx wrangler dev` and curl**

```bash
curl -s "http://127.0.0.1:8787/api/lookup?number=400300429" | head
# expect JSON with numberNational and sources array
```

- [ ] **Step 3: Commit**

```bash
git add src/worker.ts
git commit -m "feat: expose /api/lookup on Cloudflare Worker"
```

---

### Task 7: English PWA UI + Share Target

**Files:**
- Create: `public/index.html`, `public/app.js`, `public/styles.css`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/icon-192.png`

**Interfaces:**
- Consumes: `GET /api/lookup?number=`
- Produces: mobile-first English UI; Web Share Target posts shared text into the page and triggers lookup

- [ ] **Step 1: Add `manifest.webmanifest`** with `share_target` method `GET` or `POST` receiving `text` (and optional `url`) per Chrome Android docs; `display: standalone`; `start_url: /`

- [ ] **Step 2: Build `index.html` + `app.js`** — input, Look up button, loading state, result: number, summary headline, source rows with status + Open link; on load read `?number=` / share params / `text` query

- [ ] **Step 3: Minimal `sw.js`** — cache shell only (YAGNI offline lookup)

- [ ] **Step 4: Manual check in Chrome** — paste `400300429`, see aggregated result; confirm manifest link present

- [ ] **Step 5: Commit**

```bash
git add public
git commit -m "feat: add English PWA UI with Android share target"
```

---

### Task 8: README and deploy

**Files:**
- Create: `README.md`
- Modify: `package.json` scripts if needed

- [ ] **Step 1: Write README** — what it does; `npm i`; `npm test`; `npx wrangler dev`; `npx wrangler deploy`; Chrome Android “Install app” / Add to Home Screen; how Share appears; free-tier / rate-limit notes; source list

- [ ] **Step 2: Deploy once to Cloudflare free account** (user machine must be logged in to wrangler) and record the URL in README

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add setup, share-target, and deploy instructions"
```

---

## Self-review (plan author)

1. **Spec coverage:** Share + paste, Worker aggregation, free source order, ListaSpam blocked fallback, English UI, `400…` acceptance, no paid APIs, rate limit, folder path — each mapped to tasks 2–8.
2. **Steps:** Signatures and tests carry decisions; adapter HTML bodies left to implementer with fixtures.
3. **Types:** `SourceResult` / `LookupResult` / `extractSpainNumber` names consistent across tasks.
4. **Review Focus:** Covered by normalize tests (Truecaller, `400`), listaspam blocked status, responderono empty, summary none.
5. **Proportion:** Plan stays task/interface oriented vs full program transcript.
