# Testing

```bash
npm test
```

Vitest covers:

- cryptographically random 4–10 digit room codes
- invalid code / name rejection
- room create and join
- three-participant fan-out
- session resume
- room destruction
- AES-GCM + ECDH wrap/unwrap
- WebSocket join + chat relay + destroy pipeline
- `/api/health`, `/api/config`, `/api/ice`
- security headers
- SMS invite validation (Twilio optional)

Manual checklist after `npm run dev`:

1. Open two browsers (or a window + a private window).
2. Create a random room as Alice.
3. Join the same code as Bob (and optionally Charlie).
4. Send text, emoji, and an image.
5. Enable microphone / camera (needs a secure context).
6. Share a screen.
7. Copy the invite link; open it in a third browser.
8. Leave until the last participant; confirm “Room destroyed”.

WebRTC will fail without camera/mic permissions or without STUN/TURN on restrictive NATs. Chat still works.
