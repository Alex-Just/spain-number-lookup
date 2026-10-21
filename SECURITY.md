# Security

## Reporting

If you find a security issue in this project, open a private GitHub security
advisory on the repository, or email the maintainer through GitHub.

Please do not open a public issue for sensitive reports.

## Scope notes

- The `/api/lookup` endpoint is intentionally public and unauthenticated.
- It only accepts phone-number text and fans out to third-party lookup sites.
- Per-IP rate limits are in-memory per Cloudflare isolate and are not a hard
  global quota. Do not treat this Worker as a high-volume public API.
- The app does not store address books or call history.
