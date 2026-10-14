# @proof-holdings/sdk

Official JavaScript/TypeScript SDK for the [proof.holdings](https://proof.holdings) verification API.

## Installation

```bash
npm install @proof-holdings/sdk
```

## Quick Start

```typescript
import Proof from '@proof-holdings/sdk';

const proof = new Proof('pk_live_...');

// Create a phone verification
const verification = await proof.verifications.create({
  type: 'phone',
  channel: 'whatsapp',
  identifier: '+37069199199',
});

console.log('Deep link:', verification.challenge?.deep_link);

// Wait for user to verify
const result = await proof.verifications.waitForCompletion(verification.id);

if (result.status === 'verified') {
  console.log('Proof token:', result.proof?.token);
}
```

## Features

- **Typed API client** covering all public endpoints
- **Built-in polling** — `waitForCompletion()` with configurable interval/timeout
- **Offline proof verification** — verify JWT proof tokens using JWKS public keys
- **Automatic retries** with exponential backoff for network/server errors
- **Error classes** with typed error codes from the API
- **ESM + CJS** dual output — works everywhere

## Resources

### Verifications

```typescript
// Create
const v = await proof.verifications.create({ type: 'phone', channel: 'telegram', identifier: '+1...' });

// Retrieve
const v = await proof.verifications.retrieve('verification_id');

// List (paginated)
const list = await proof.verifications.list({ status: 'verified', limit: 20 });

// Trigger DNS/HTTP check
await proof.verifications.verify('verification_id');

// Submit OTP code
await proof.verifications.submit('verification_id', 'A1B2C3');

// Poll until complete — uses exponential backoff per POLLING_CONTRACT.md.
// Defaults: 2s initial interval, 1.5× backoff, 30s max, 0–500ms jitter, 10min timeout.
const result = await proof.verifications.waitForCompletion('verification_id', {
  interval: 2000,     // initial poll interval in ms (default)
  timeout: 600000,    // 10 min timeout (default)
  // backoff: 1.5, maxInterval: 30000, jitter: 500 — contract defaults
  // signal: abortController.signal — optional AbortSignal for cancellation
});

// WABA (WhatsApp Business) verification
const waba = await proof.verifications.create({
  type: 'waba',
  channel: 'waba_otp',
  identifier: '+37069199199',
});
// OTP is sent via WhatsApp — submit with proof.verifications.submit(waba.id, code)

// Telegram Bot verification
const bot = await proof.verifications.create({
  type: 'telegram_bot',
  channel: 'telegram_bot_token',
  identifier: '@mybusinessbot',
});
// Submit bot token with proof.verifications.submit(bot.id, botToken)
```

### Verification Requests (Multi-Asset)

```typescript
const request = await proof.verificationRequests.create({
  assets: [
    { type: 'phone', required: true },
    { type: 'email', required: true },
    { type: 'domain', identifier: 'example.com', required: false },
  ],
  redirect_url: 'https://yourapp.com/done',
  callback_url: 'https://yourapp.com/webhooks',
});

console.log('Send user to:', request.verification_url);

const completed = await proof.verificationRequests.waitForCompletion(request.id);
```

### Proofs

```typescript
// Online validation (checks revocation)
const result = await proof.proofs.validate(proofToken);

// Offline verification — no API call with your key. Reads two public documents: the JWKS for
// the signature, and the issuer's status list for revocation (checked by default).
const offline = await proof.proofs.verifyOffline(proofToken);
if (offline.valid) {
  console.log('Verified:', offline.payload?.type, offline.payload?.verified_at);
} else {
  // 'revoked' | 'suspended' | 'expired' | 'invalid' | 'status_unavailable'
  // | 'key_revoked' | 'jwks_stale' | 'wrong_key_purpose' | 'outside_key_window'
  // | 'token_lifetime_exceeded' | 'unknown_key' — see "Signing-key rotation" below
  console.log('Refused:', offline.reason);
}

// `status_unavailable` means the revocation status could NOT be read — an unreachable list, one
// that failed its own checks, or a slot the list does not cover. It is a refusal to guess, not a
// claim that the proof is withdrawn. A token minted without a status-list slot stays valid and
// reports `revocation_checked: false`, exactly as the issuer's own `validate` answers for it.

// Signature only, for an air-gapped check against a warm key cache:
const signatureOnly = await proof.proofs.verifyOffline(proofToken, { checkRevocation: false });
console.log(signatureOnly.revocation_checked); // false — never assume it was checked

// Revoke a proof
await proof.proofs.revoke('verification_id', 'user_request');

// Get revocation list
const { revoked } = await proof.proofs.listRevoked();
```

### Signing-key rotation

`verifyOffline` fetches and caches the issuer's key set (JWKS) itself and follows its rotation rules.
The cached set is reused for 10 minutes; a `kid` it does not know triggers one refetch, at most
once every 30 seconds.

- **`key_revoked`** — the issuer revoked the key that signed the token. The result carries
  `pull_hint: { issuer_origin, handle }`: where to fetch the re-signed token (`handle` is the proof's
  `proof_id`, or a delegation's `sub`). The handle is read from the token itself, whose signature a
  revoked key no longer vouches for: URL-encode it before building a request from it. A revocation
  takes effect only after two key-set fetches at least 5 minutes apart both carry it, and is then kept
  for a year.
- **`jwks_stale`** — the key set could not be refreshed and the cached copy is older than
  `maxJwksAgeMs` (default 24 hours, at most 25 days; `new Proof(key, { maxJwksAgeMs })`). The result
  carries `cache_age_seconds`. Call `refreshJWKS()` once the issuer is reachable.
- **`wrong_key_purpose`**, **`outside_key_window`**, **`token_lifetime_exceeded`** — the key belongs
  to another token family, the token was signed outside the key's validity window, or it lives longer
  than the key allows. **`unknown_key`** — no published key matches the token's `kid`.

Revoked-key tombstones are kept in memory only — they are not persisted, so a restarted process
learns them again from the issuer. `clearTombstones()` forgets them on purpose. `refreshJWKS()` makes
the next verification refetch the key set (and drops the cached status list); it does not forget
tombstones.

### Sessions (Phone-First Flow)

```typescript
const session = await proof.sessions.create({ channel: 'telegram' });
console.log('QR code:', session.qr_code);

const completed = await proof.sessions.waitForCompletion(session.id);
console.log('Phone:', completed.phone_number);
```

### Webhook Deliveries

```typescript
const deliveries = await proof.webhookDeliveries.list({ status: 'failed' });
await proof.webhookDeliveries.retry(deliveries.data[0].id);
```

## Error Handling

```typescript
import { Proof, ValidationError, RateLimitError, AuthenticationError } from '@proof-holdings/sdk';

try {
  await proof.verifications.create({ ... });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid params:', error.code, error.details);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited');
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  }
}
```

## Configuration

```typescript
const proof = new Proof('pk_live_...', {
  baseUrl: 'https://api.proof.holdings', // default
  timeout: 30000,                         // 30s request timeout (default)
  maxRetries: 2,                          // retry failed requests (default)
  maxJwksAgeMs: 86_400_000,               // offline verification: 24h stale bound (default)
});
```

## Credentials

Sign in once with `npx @proof-holdings/mcp-server login` and construct the client with no key:

```typescript
const proof = new Proof();                        // or new Proof({ baseUrl: '...' })
```

When the key argument is omitted it is resolved in this order:

1. `PROOF_API_KEY`, when set and non-empty.
2. The entry for this client's base URL in `~/.proof-holdings/credentials`, the file the login
   command writes. The file is keyed by base URL, so a key saved against staging is never sent
   to production.
3. Otherwise construction throws, naming the three roads: pass the key, set `PROOF_API_KEY`, or
   run `npx @proof-holdings/mcp-server login`.

The base URL is the `baseUrl` option, else a non-empty `PROOF_BASE_URL`, else
`https://api.proof.holdings`. An explicit key is used as given, and an explicit empty key
(`new Proof('')`) is an error — neither reads the environment or the file.

## Requirements

- Node.js 18+ (uses native `fetch`)
- Not for browsers: the SDK imports `node:fs`, `node:os`, `node:path` and `node:zlib`

## License

MIT
