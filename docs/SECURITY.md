# Security

## Guarantees we aim for

- Signaling is origin-checked in production and authenticated with a per-participant session token after join.
- Room codes are generated with `crypto.randomInt`, never sequential database IDs.
- Input is validated on the server (Zod + allowlists). Client checks are UX only.
- Helmet sets CSP, Referrer-Policy `no-referrer`, HSTS in production, and clickjacking protections unless `ALLOW_FRAMING=true`.
- Rate limits apply to HTTP, WebSocket upgrades, joins, room creation, and chat.
- File MIME types and sizes are enforced server-side. Ciphertext size is capped.
- No secrets in frontend code. Twilio / TURN credentials stay in environment variables.

## Room codes are identifiers

A 4–10 digit code is guessable in principle. CipherRoom therefore:

- only keeps rooms that currently exist (occupied + short grace)
- rate-limits joins and creates, with temporary lockouts
- issues a 256-bit session token after join for signaling
- recommends sharing invite links through a channel you already trust

Do not treat the number itself as a password.

## Headers and cookies

CipherRoom does not use authentication cookies. Session tokens live in memory and `sessionStorage`. `SameSite` cookie rules are therefore not the primary control; origin checks on the WebSocket upgrade are.

## Production checklist

- [ ] TLS terminated at the proxy / Render
- [ ] `NODE_ENV=production`
- [ ] `APP_URL` set to the public HTTPS origin
- [ ] `TRUST_PROXY=true` behind a reverse proxy
- [ ] `ALLOW_FRAMING=false`
- [ ] TURN credentials configured (coturn or equivalent)
- [ ] Strong random `TURN_PASSWORD`
- [ ] Twilio vars unset unless needed
- [ ] No `.env` in git
- [ ] Security headers verified on `/api/health`
- [ ] Rate-limit values tuned for your abuse model
- [ ] Process supervisor / container health check on `/api/health`

## What a server compromise can do

An attacker who replaces the JavaScript can serve a malicious client that exfiltrates keys. Host the app from infrastructure you trust, pin versions, and prefer a Content Security Policy that forbids unexpected script origins (already defaulted to `'self'`).
