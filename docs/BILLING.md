# Billing, passes, and ads

CipherChat does not create user accounts. Premium is an **anonymous pass**.

## How access works

1. Customer pays (Stripe Checkout if `STRIPE_SECRET_KEY` is set, otherwise the Stripe **test-card sandbox**).
2. Server generates `CCHAT-XXXX-XXXX-XXXX`, stores **only SHA-256(code)**, and returns the plaintext once.
3. Browser keeps a signed entitlement token in `localStorage` plus the pass for convenience.
4. Any device can **Redeem** the pass. Rate-limited. No email.

Party passes also bind a room code, seat count, and hold duration. Extra invites are $2. Unused seats can be refunded pro-rata.

## Stripe

| Env | Effect |
| --- | --- |
| `STRIPE_SECRET_KEY=sk_test_…` | Real Stripe Checkout in test mode |
| `STRIPE_SECRET_KEY=sk_live_…` | Live charges |
| unset + `BILLING_SANDBOX=true` | Local checkout that accepts [Stripe test PANs](https://docs.stripe.com/testing) (`4242…` succeeds) |

Webhook: `POST /api/billing/webhook` with `STRIPE_WEBHOOK_SECRET`.

Optional price IDs: `STRIPE_PRICE_PLUS_MONTHLY` / `_YEARLY` / `STRIPE_PRICE_PRO_*`. If omitted, products are created with lookup keys `cipherchat_plus_monthly`, etc.

## Catalog

- **Party Spark** $6 — 8 guests / 2 h
- **Party House** $12 — 16 guests / 6 h
- **Party Night** $22 — 32 guests / 12 h
- **Party Weekend** $39 — 40 guests / 48 h
- **Plus** $8 / mo or $72 / yr
- **Pro** $18 / mo or $168 / yr
- Extra invite $2

## Ads

House ads (Plus/Party) show on marketing pages only — never inside a room.

Optional:

```
HOUSE_ADS=true
ETHICALADS_SITE=your-publisher
ADSENSE_CLIENT=ca-pub-xxxxxxxx
```

AdSense/EthicalAds scripts load only when those vars are set.

## Privacy

- No CipherChat login, email, or profile
- Card data never touches this process
- Pass store is `data/passes.json` (hash, seats, expiry, Stripe ids)
- Chat is still RAM-only
