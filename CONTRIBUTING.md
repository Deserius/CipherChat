# Contributing to CipherRoom

Thank you for helping keep ephemeral communication actually ephemeral.

## Invariants (do not break)

1. No accounts, emails, or permanent profiles for the core path.
2. No durable chat history. Memory only, then destroy.
3. No analytics, ads, or fingerprinting in the default build.
4. Room codes are identifiers, not cryptographic secrets — keep rate limits.
5. Never put Twilio / TURN secrets in frontend code.
6. Do not claim “nothing can ever be logged” or “unbreakable E2E” beyond what the code does.
7. When the last participant leaves, run the full destruction pipeline.

## Dev

```bash
npm install
npm run dev
npm test
```

Please add tests for room lifecycle, validation, and crypto when you change those paths.
