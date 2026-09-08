# Threat model

## In scope (application tries to protect)

| Threat | Mitigation |
| --- | --- |
| Passive network observer on the path to peers | TLS + WebRTC DTLS/SRTP + client-side message encryption |
| XSS | React text nodes, CSP, no `dangerouslySetInnerHTML`, URL allowlist for links |
| CSRF | No cookie session; JSON + WS commands require a live authenticated socket |
| Room-code guessing | Short-lived rooms, rate limits, lockouts, join throttling |
| WebSocket abuse | Origin check, per-IP connection cap, payload cap, message rate |
| Message injection | Session token + participant id assigned by server; ciphertext is opaque |
| File upload attacks | MIME allowlist, size cap, no durable storage, encrypted payload |
| Replay of signaling | Short-lived rooms and sessions; ICE is peer-specific |
| Session hijacking via XSS | sessionStorage token + CSP; still fails if XSS is achieved |

## Out of scope / cannot protect

- A compromised device (malware, stolen unlocked laptop).
- A malicious participant you invited — they can screenshot, record, or leak the room key.
- A replaced frontend bundle (malicious CDN / compromised deploy).
- Global passive observation of IP addresses by STUN, TURN, host, or ISP.
- Traffic analysis (who talked to whom, when, message sizes).
- Lawful intercept at the infrastructure layer.
- Users treating a 6-digit code as a cryptographic secret.

## Malicious clients

The server never trusts client-side validation. Names, codes, MIME types, sizes, and rates are re-checked. A modified client cannot read other rooms’ ciphertext without the room key, but it can spam its own room until rate-limited.

## Server compromise

The server does not hold the room AES key. It *does* hold display names, membership, and ciphertext in RAM for live rooms, and it can drop, delay, or modify ciphertext (integrity of chat depends on the AES-GCM tag, which a server that only relays cannot forge for a key it does not have — but it can withhold or replay). A compromised server can also ship malicious JavaScript on the next page load.
