# Spain Number Lookup

English PWA + Cloudflare Worker that accepts a shared or pasted Spain phone
number, checks free Spanish lookup sources, and returns **one aggregated
result page**.

Live demo: [spain-number-lookup.alex-just.workers.dev](https://spain-number-lookup.alex-just.workers.dev)

## What it does

1. Paste a number, or share one from Android (Truecaller / dialer share sheet).
2. Worker normalizes `+34` / spaced / `tel:` / Truecaller share text.
3. Queries free sources in order and merges a summary with per-source status.
4. Shows deep links so you can open the original page.

### Sources (v1)

| Order | Source | Notes |
| --- | --- | --- |
| 1 | ListaSpam | Owner, community reports, spam labels |
| 2 | Tellows | Score, owner, community reports |
| 3 | Teledigo | Numbering assignment / operator |
| 4 | ResponderONo | Community rating when users have rated the number |
| 5 | OpenSpam | Deep link (no free parse API in v1) |
| 6 | QuienHaLlamado | Secondary community signal |
| 7 | Truecaller | Deep link (login wall) |

No paid APIs. Odd prefixes like `400…` are accepted.

## Setup

```bash
git clone https://github.com/Alex-Just/spain-number-lookup.git
cd spain-number-lookup
npm install
npm test
npm run typecheck
npm run dev
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787) and look up e.g. `400300429`.

## Deploy (Cloudflare free)

```bash
npx wrangler login   # once
npm run deploy
```

Wrangler prints a `*.workers.dev` URL after deploy.

### CI deploy (GitHub Actions)

Every push to `main` runs tests and typecheck, then deploys the Worker.
Required repository secrets:

1. `CLOUDFLARE_ACCOUNT_ID` — from `npx wrangler whoami`.
2. `CLOUDFLARE_API_TOKEN` — create at
   [API Tokens](https://dash.cloudflare.com/profile/api-tokens) with the
   **Edit Cloudflare Workers** template, scoped to this account.

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
```

## Code quality (Qlty + pre-push)

```bash
curl https://qlty.sh | sh   # once per machine
git config core.hooksPath .githooks
```

`pre-push` runs `npm test`, `npm run typecheck`, then `qlty check` on the
commits being pushed. Existing issues on the upstream branch do not block a
push; new issues in changed files do. Bypass once with `git push --no-verify`
if needed.

`.qlty/qlty.toml` enables `biome`, `markdownlint`, `trufflehog`, and
`osv-scanner`. Run the full tree with:

```bash
qlty check --all
```

## Android Share sheet

1. Open the deployed URL in **Chrome** on Android.
2. Install app / **Add to Home screen**.
3. From a missed call, Share the number (Truecaller text is fine).
4. Choose **Spain Number Lookup** / **ES Lookup**.

The Web Share Target sends `text` (and optional `title` / `url`) into the PWA.
The app **joins** those fields before lookup, so a Truecaller URL in `url` is
not dropped when `text` is only boilerplate.

## API

```http
GET /api/lookup?number=+34400300429
```

```http
POST /api/lookup
Content-Type: application/json

{"number":"400300429"}
```

Responses: `200` lookup JSON, `400` invalid number or request body,
`405` method not allowed, `413` POST body over 8 KiB (checked even when
`?number=` is present), `429` rate limited (per IP, in-memory per
isolate), `500` unexpected error with a JSON `error` field.

`summary.sourceId` points at the source behind the headline; sources may
include `reviews` (recent Tellows community reports with author, date,
score, classification, and text).

## Project layout

- `src/worker.ts` — HTTP entry
- `src/normalize.ts` — share-text extraction
- `src/lookup.ts` — fan-out orchestration
- `src/sources/*` — per-site adapters
- `public/*` — English PWA

## Limits

- ListaSpam and Teledigo may return `blocked` to datacenter IPs. ListaSpam
  retries the public page through Google Translate's proxy (the number is
  sent to that proxy); if the retry also fails, the row stays blocked and
  the deep link remains.
- The lookup API is public and unauthenticated. Rate limits are light and
  per-isolate — do not use this as a bulk API.
- Third-party site HTML can change; adapters may need updates.
- Changing the Worker hostname later means reinstalling the PWA.

## License

MIT — see [LICENSE](LICENSE).
