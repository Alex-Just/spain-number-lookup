# Spain Number Lookup — Design

**Date:** 2026-10-21  
**Status:** draft for approval  
**Location:** repository root (`spain-number-lookup`)

## Intent and why

After a missed call on Android in Spain, Truecaller often shows only the bare number. The user wants to **share that number into one personal app** and get a **single English result page** after free Spanish lookup sources have been checked in order — any useful clue about who called (spam label, operator, community comments, risk score).

This is a personal tool, not a product for other users or the Play Store.

## Goals

- Accept a Spanish phone number from **Android Share** (PWA Web Share Target) and from paste / manual entry.
- Run free lookups against Spain-relevant sources on a **free Cloudflare Worker**.
- Return **one aggregated result**: best summary plus per-source status (`found` / `empty` / `failed`) and deep links to originals.
- Work for odd Spain prefixes (e.g. `400…`) that StoryCheck rejects but ListaSpam / Teledigo accept.
- Keep the stack **free** (Cloudflare free tier; no paid reverse-lookup APIs).
- UI language: **English**.

## Non-goals

- Native Android / Play Store app.
- Live incoming-call overlay or call blocking.
- Uploading or syncing contacts.
- Paid services (StoryCheck, ClarityCheck, Tellows partner API, OpenSpam enterprise API) in v1.
- Claiming a definitive identity when sources have no data.

## Anti-goals (failure even if it “works”)

- Opening many browser tabs instead of one merged result.
- Fake confidence (“identified as X”) when evidence is thin or empty.
- Requiring paid accounts to get basic Spain spam/operator signals.
- Breaking on `+34` / spaced / shared Truecaller text payloads.

## Constraints

- **Budget:** free Cloudflare (Workers + Pages or Workers static assets).
- **Client:** installable PWA on Chrome Android for Share Target; also usable as a normal URL.
- **Legal / ToS:** prefer official or stable public endpoints; do not depend on brittle scraping as the only path. Where a site blocks bots (e.g. ListaSpam), degrade to deep-link fallback and mark status honestly.
- **Privacy:** no contact book access; do not store lookup history on the server beyond short optional cache (builder may add in-memory/KV cache with TTL; default off or short TTL).
- **Folder:** clone of this repository.

## User flow

1. Missed call → open share sheet (e.g. from Truecaller / dialer) sharing text that includes a number (and often a Truecaller URL).
2. Choose **Spain Number Lookup** (installed PWA).
3. App extracts the number from shared text (or user pastes).
4. Client calls Worker `GET/POST /api/lookup?number=…` (or JSON body).
5. Worker normalizes, queries sources in parallel where safe (or short ordered fan-out), merges, returns JSON.
6. Result page shows summary + source rows + links.

## Number normalization (builder must implement)

Accept inputs such as:

- `+34400300429`
- `400 30 04 29`
- Truecaller share text containing a number and `https://truecaller.com/search/es/…`

Normalize to:

- E.164-ish: `+34` + 9 national digits when Spain.
- National: 9 digits for Spain lookup URLs.

Reject clearly if not a plausible Spain number after parse (still allow prefixes that start with `4`, not only `6/7/8/9`).

**Builder call:** treat Spain national numbers as 9 digits starting with `4–9` for v1 acceptance (covers special/`400` ranges); do not use StoryCheck-style “mobile/landline only” validation.

## Sources (v1 priority order)

| Priority | Source | Free deep link / API | Role |
| --- | --- | --- | --- |
| 1 | ListaSpam | `https://www.listaspam.com/busca.php?Telefono={9}` | Spain spam community labels, search counts |
| 2 | Tellows.es | Page `https://www.tellows.es/num/{9}`; optional public JSON `…/basic/num/+34{9}?json=1` | Risk score / comments |
| 3 | Teledigo | `https://www.teledigo.com/{9}` | Original numbering assignment / operator |
| 4 | ResponderONo | `https://www.responderono.es/numero-de-telefono/{9}` | Community rating when users have rated the number (404 = empty) |
| 5 | OpenSpam | Free web lookup on openspam.es if Worker can call without API key; else deep-link only | Spain community |
| 6 | QuienHaLlamado | `https://www.quienhallamado.es/{9}` | Secondary comments |
| 7 | Truecaller | `https://www.truecaller.com/search/es/{9}` | Last; often empty / login wall |
| — | CNMC | Form only (`numeracionyoperadores.cnmc.es`) | Optional later; not required for v1 |
| — | StoryCheck / ClarityCheck | Paid / rejects `400…` | **Out of v1** |

### Fetch policy

- Attempt Worker-side fetch for sources that return useful HTML/JSON without login.
- ListaSpam often returns **403** to non-browser clients → status `failed` or `blocked`, still show deep link.
- Never invent labels; only surface what was parsed or “no data”.
- Timeouts: keep total lookup snappy (builder: e.g. ~8–15s overall budget; per-source timeout).

## Result model (logical)

```text
numberE164, numberNational
summary: { headline, confidence: high|medium|low|none, notes[] }
sources: [{ id, name, status: found|empty|failed|blocked, label?, detail?, score?, url }]
```

**Summary rules (builder call):**

- Prefer ListaSpam commercial/spam tags when present.
- Else Tellows score + category if comments exist.
- Else Teledigo operator assignment as weak “who” signal.
- `confidence: none` when all empty/failed — headline like “No useful matches yet”.

## Architecture

```text
[Android Chrome PWA] --share/paste--> [static UI]
        |                                |
        +-------- /api/lookup ----------> [Cloudflare Worker]
                                              |
                              fetch free sources (parallel)
                                              |
                                         merge JSON
```

- **Frontend:** static HTML/CSS/JS (or minimal Vite) English UI; Web App Manifest + service worker for install; `share_target` for `text/plain` / `text/*`.
- **Backend:** one Worker project; CORS only as needed for same-origin Pages binding or same Worker serving UI.
- **Deploy:** Cloudflare Pages + Worker, or Worker assets — builder picks the simplest free path.

## UI (English, v1)

- Home: number field, Look up button, short install tip for Share (“Add to Home Screen in Chrome”).
- Loading: progress while sources run.
- Result: large number, summary headline, list of sources with status badges and “Open” links.
- No cards-for-decoration requirement beyond clear readable rows; keep mobile-first.

## Testing expectations

- Unit tests for number extraction from Truecaller-style share text and Spain normalization (including `400300429`).
- Fixture-based parse tests for at least Tellows JSON and one HTML source.
- Manual check: install PWA, share sample number, see aggregated page.

## Builder check — settled calls (author defaults)

These were open after a builder review; settled here so planning can proceed without another round:

1. **API access:** v1 Worker `/api/lookup` is reachable without login. Mitigate abuse with **per-IP rate limits** on the Worker. Optional shared secret / Cloudflare Access is a later hardening step, not required for personal use.
2. **Share payloads:** Support `text/plain` and `text/*` share target fields; also accept an optional shared URL. Extract numbers from Truecaller-style text, bare numbers, `+34…`, and `tel:` URIs. **No vCard / contact file** parsing in v1.
3. **Language of source text:** English chrome (buttons, badges, headlines). **Keep Spanish strings from sources as returned** (e.g. “Llamadas comerciales”); do not machine-translate in v1.
4. **Multiple numbers in one share:** Prefer a number that appears in a Truecaller (or similar) search URL in the same text; else the **first** plausible Spain national / `+34` candidate. Do not prompt to choose in v1.
5. **Origin:** Deploy on the default Cloudflare free hostname (`*.workers.dev` / `*.pages.dev`). Custom domain is optional later; changing origin later means reinstalling the PWA.

## What’s left to the builder

- Exact Cloudflare project layout (Pages vs Worker assets).
- HTML parsers for each source (selectors may change; isolate adapters).
- Whether to use short KV cache.
- Visual polish within English mobile-first UI.
- README with deploy and “Add to Home Screen / Share” steps.
- Concrete rate-limit thresholds within free Worker limits.

## Research notes (2026-10-21)

Sample `+34 400 30 04 29`:

- ListaSpam (browser): “Llamadas comerciales”, searches > 0, denuncias 0.
- Teledigo: assigned to AIRE NETWORKS DEL MEDITERRÁNEO.
- Tellows: score 5, little/no comments.
- ResponderONo: 404 (empty).
- StoryCheck: invalid — rejects non 6/7/8/9 Spain shapes.
