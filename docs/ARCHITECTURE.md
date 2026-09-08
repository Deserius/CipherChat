# CipherRoom architecture

```
┌──────────────┐     HTTPS / WSS      ┌──────────────────────────┐
│  Browser     │ ◄──────────────────► │  Node signaling server   │
│  React + Vite│                      │  Express + ws            │
│              │                      │  In-memory RoomManager   │
│  Web Crypto  │                      │  (no message store)      │
│  WebRTC mesh │                      └────────────┬─────────────┘
│              │                                   │
│  DTLS/SRTP   │◄──────── media ───────────────────┤ optional TURN
└──────────────┘                                   │ optional Twilio
```

## Processes

A single Node process serves:

- `GET /` — the SPA
- `GET /api/health|config|ice|ops` — public/ops endpoints
- `POST /api/invite/sms` — optional Twilio
- `GET /ws` — WebSocket upgrade for signaling + ciphertext relay

There is no required database. PostgreSQL is not used. Redis/Valkey is optional for a future multi-instance adapter; the default is a single in-memory map with aggressive destruction.

## Room lifecycle

1. Client opens WebSocket and sends `join` with a display name and either a 4–10 digit code or `createRandom`.
2. Server mints a participant id and a 256-bit session token. The token authenticates later signaling messages on that socket (and can resume after a brief disconnect).
3. Clients generate ECDH P-256 identities and announce public keys. The first ready member mints an AES-256-GCM room key and wraps it to each peer.
4. Chat and files are encrypted in the browser; the server relays opaque blobs.
5. WebRTC offers, answers, and ICE candidates are forwarded as `signal` messages. Media is DTLS/SRTP between peers (or via TURN).
6. On disconnect, the participant stays in a grace window so a refresh can resume.
7. When no connected participants remain, a destroy grace timer starts.
8. Destruction closes sockets, drops membership, discards tokens, and deletes the room object. Nothing is flushed to disk.

## Scaling

Small rooms use a full mesh of `RTCPeerConnection`s. The signaling protocol (`signal` + `to`) is SFU-agnostic: a LiveKit / mediasoup / Janus adapter can replace the mesh `CallManager` without changing the chat/crypto layer. See `client/src/webrtc/callManager.ts` and `server/src/providers/communication.ts`.

## What is intentionally absent

- User tables
- Message tables
- Analytics
- Advertising SDKs
- Persistent file buckets
