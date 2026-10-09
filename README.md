# CipherChat

**Private communication. No permanent identity.**

CipherChat is an open-source, privacy-first web application for temporary encrypted communication rooms. You enter a display name and a 4–10 digit room code — nothing else. No account, no email, no password, no permanent profile.

When the last participant leaves, the room is destroyed. Messages are not written to a database. The server is a signaling and ciphertext relay, not a system of record.

> Designed for minimal data retention. This software does **not** claim that hosting providers, STUN/TURN servers, or networks never generate technical logs.

## Features

- Zero-account join: display name + room code
- Cryptographically random 4–10 digit room identifiers
- Real-time group chat over WebSockets
- Client-side AES-256-GCM messaging with ECDH P-256 key wrap
- WebRTC audio, video, screen share, device selection
- Typing indicators, join/leave notices, reactions, local delete
- Encrypted ephemeral file/image sharing
- Copy room code / invite link (`/r/{code}`)
- Automatic room destruction and session expiry
- Optional Twilio SMS invites (web features work without it)
- Optional CipherChat Plus / Pro and **Party passes** (anonymous `CCHAT-` codes, Stripe Checkout or test-card sandbox)
- First-party house ads on marketing pages only (never inside a room)
- In-app Help (`/help`)
- PWA (static shell only — never caches room content)
- No analytics pixels or advertising trackers
- Helmet / CSP / rate limits / origin checks
- Docker and Render deployment configs

## Architecture

```
Browser (React + TypeScript + Vite)
   │  HTTPS + WSS
   ▼
Node signaling server (Express + ws)
   │  in-memory RoomManager
   ▼
WebRTC mesh (DTLS/SRTP) ── optional TURN (coturn)
                         ── optional Twilio PSTN/SMS
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/BILLING.md](docs/BILLING.md), [docs/ENCRYPTION.md](docs/ENCRYPTION.md), [docs/SECURITY.md](docs/SECURITY.md), and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Security model (short)

- **Room codes are identifiers, not secrets.** Guessing is mitigated by rate limits, lockouts, and the fact that rooms only exist while occupied (plus a short grace period). After join, a 256-bit session token authenticates signaling.
- **Chat/files:** encrypted in the browser with AES-256-GCM. The server relays ciphertext. Private keys never leave the device.
- **Media:** WebRTC DTLS/SRTP. A TURN server, if configured, relays encrypted packets and will see IP addresses.
- **We do not claim end-to-end encryption of media beyond WebRTC’s own transport**, and we do not claim immunity to a compromised device, a malicious invitee, or a replaced JavaScript bundle.

## Privacy model (short)

**Intentionally not retained**

- Accounts, emails, passwords, profiles
- Chat history after destruction
- Uploaded files after destruction
- Advertising identifiers
- Analytics events

**Held in RAM while a room is live**

- Display names, participant ids, session tokens
- Ciphertext in flight
- WebRTC signaling blobs

**Outside this application’s control**

- Host/proxy/CDN/OS logs
- STUN/TURN IP observations
- Optional Twilio processing

Full text: in-app `/privacy` and `/terms`.

## Room destruction pipeline

```
Last participant leaves
        ↓
Reconnect grace (default 15s)
        ↓
Room-empty grace (default 30s)
        ↓
Broadcast `room-destroyed`
        ↓
Close sockets · drop membership · drop session tokens
        ↓
Drop in-memory messages/files/keys (browser + server)
        ↓
Room code becomes unused
```

Hard limits also destroy a room at max lifetime or inactivity (see `.env.example`).

## Requirements

- Node.js 20+
- A modern browser with WebRTC and Web Crypto
- Optional: coturn, Twilio, Redis/Valkey

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

This starts:

- API + WebSocket on `http://localhost:3000`
- Vite (proxies `/api` and `/ws`) on `http://localhost:5173`

Open `http://localhost:5173`. Enter a name and either join a code or create a random room. Open a second browser profile to join as someone else.

Production-style (serves the built SPA from the Node server):

```bash
npm run build
npm start
```

## Environment variables

See [`.env.example`](.env.example). Important ones:

| Variable | Purpose |
| --- | --- |
| `PORT` / `APP_URL` | Listen port and public origin for invite links |
| `ALLOW_FRAMING` | `false` in production (clickjacking protection) |
| `TRUST_PROXY` | `true` behind Render / Nginx / Cloudflare |
| `ROOM_CODE_LENGTH` | Default random code length (4–10, default 6) |
| `ROOM_MAX_PARTICIPANTS` | Default 12 |
| `PARTICIPANT_GRACE_MS` / `ROOM_DESTROY_GRACE_MS` | Lifecycle |
| `STUN_SERVER` | Comma-separated STUN URLs |
| `TURN_SERVER` `TURN_USERNAME` `TURN_PASSWORD` | TURN |
| `TWILIO_ACCOUNT_SID` `TWILIO_AUTH_TOKEN` `TWILIO_PHONE_NUMBER` | Optional SMS |
| `REDIS_URL` | Reserved for multi-instance TTL maps (unused by default) |

**Never put Twilio or TURN secrets in frontend code or commit a real `.env`.**

## WebRTC and TURN

Browsers on the same LAN often connect peer-to-peer via STUN. Across symmetric NATs you need TURN.

Recommended open-source server: [coturn](https://github.com/coturn/coturn).

```
TURN_SERVER=turn:turn.example.com:3478
TURN_USERNAME=cipher
TURN_PASSWORD=long-random-secret
```

STUN/TURN operators can observe client IP addresses. Document that for your users.

## Optional Twilio

Web chat/video work with Twilio unset. If you set the three `TWILIO_*` variables, `POST /api/invite/sms` can send an invite link. Credentials stay server-side. The `CommunicationProvider` interface in `server/src/providers/communication.ts` is the plug-in point for PSTN.

## Optional SFU

Mesh WebRTC is used for small rooms. The signaling envelope (`type: "signal", to, data`) can target a LiveKit, mediasoup, or Janus worker without changing chat/crypto. Do not expect a 40-person call to work as a mesh.

## Docker

```bash
docker compose up --build
```

The image serves the SPA + API + WebSocket on port 3000.

## Render

This repo includes `render.yaml` and a `Dockerfile`.

1. Create a new Web Service from the repo (Docker runtime).
2. Set `APP_URL` to `https://<your-service>.onrender.com`.
3. Set `TRUST_PROXY=true`.
4. Add TURN credentials if you have them.
5. Health check: `/api/health`.

Render (and every host) may emit infrastructure logs. CipherChat itself does not persist chat.

## Testing

```bash
npm test
```

Details: [docs/TESTING.md](docs/TESTING.md).

## Production security checklist

See [docs/SECURITY.md](docs/SECURITY.md). At minimum: TLS, `NODE_ENV=production`, `ALLOW_FRAMING=false`, TURN, no secrets in git, headers verified.

## Project structure

```
client/     React + Vite + Tailwind UI, WebRTC, Web Crypto, PWA
server/     Express, WebSocket signaling, in-memory rooms, providers
shared/     Wire protocol and constants
docs/       Architecture, encryption, threat model, testing
tests/      Vitest unit + protocol + HTTP tests
```

## What data is retained vs not

| Data | Retained? |
| --- | --- |
| Display name | RAM, room lifetime only |
| Room code | RAM, room lifetime only |
| Chat plaintext | Never on server; ciphertext relayed then dropped |
| Files | Relayed in RAM; never a durable bucket |
| Encryption keys | Browser only |
| IP addresses | Used for in-memory rate limits (hashed), not stored with rooms |
| Analytics | Not collected |

## Developer, copyright, and disclaimer

CipherChat was created by **Deserius Arte** and is published by **Hustler Anomalies Enterprises LLC**.

© 2026 Deserius Arte. The CipherChat name and original product materials are protected by copyright.

**Disclaimer:** Deserius Arte and Hustler Anomalies Enterprises LLC are not legally responsible for how this application is used, for communications that occur in rooms, or for any loss, damage, or claim arising from use or misuse. The software is provided as-is. See `/about` and `/terms` in the app.

## License

MIT, with the copyright notice above. Contributions welcome: keep the zero-account, zero-history invariants, do not add trackers, and do not weaken room destruction.
