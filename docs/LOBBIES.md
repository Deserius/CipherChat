# Common lounges

Public themed rooms with a hard occupancy cap. Catalog: `shared/lobbies.ts`.

## Overflow

1. Join `lobby: workout-kingz` (no numeric code).
2. Server attaches you to the lowest index with a free seat.
3. If all instances are full, it creates `Workout Kingz N+1` (internal code still numeric).
4. Up to three people in the previous instance get `split-offer` — Stay or Go.

Invite URL for a lounge is `/c/{slug}` so new people still land in a room with space.

## Rules

`RulesModal` + `LOBBY_RULES`. No nudity, hate, or illegal content in lounges. Private / Party rooms are the alternative. Illegal content is forbidden everywhere.

## Secrets

`whisper` is unicast ciphertext. Keys: ECDH P-256 between the two peers (`RoomCrypto.encryptDirect`).
