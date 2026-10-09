# Make CipherChat yours

Operator notes. No legal advice. Never commit live secrets.

## Brand

- `shared/constants.ts` — `APP_NAME`, tagline
- `client/src/components/SiteFooter.tsx` — developer / company / year
- `client/src/components/Logo.tsx` — mark
- `client/index.html` — title and meta

## Lounges

Edit `shared/lobbies.ts`:

```ts
{ slug: 'my-lounge', name: 'My Lounge', theme: 'X', blurb: '…', maxUsers: 8, accent: '#00e5ff' }
```

`maxUsers` is the occupancy that triggers `Name 2`. Overflow logic is in `server/src/rooms/manager.ts` (`joinLobby`, `offerSplit`).

## Payments

See [BILLING.md](BILLING.md).

- Amounts: `shared/billing.ts` (`PRICE_CATALOG`, `PARTY_PACKS`, `PARTY_ADDON_USD`)
- Stripe vs sandbox: `STRIPE_SECRET_KEY` / `BILLING_SANDBOX`
- Pass storage: `data/passes.json`

## Ads

`HOUSE_ADS=true` (default). Optional `ADSENSE_CLIENT`, `ETHICALADS_SITE`. Ads never load inside `/room`.

## ICE / TURN

`.env` `STUN_SERVER`, `TURN_SERVER`, `TURN_USERNAME`, `TURN_PASSWORD`. Code: `server/src/webrtc/ice.ts`.

## Twilio SMS

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

## Limits

`ROOM_MAX_PARTICIPANTS`, `MAX_FILE_BYTES`, `ROOM_DESTROY_GRACE_MS`, rate limits — `server/src/config.ts`.

## Deploy

[DEPLOY.md](DEPLOY.md). Persist `data/` if you use pass codes. One Node process serves SPA + `/api` + `/ws`.
