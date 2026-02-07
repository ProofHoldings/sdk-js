# @proof/sdk

Official JavaScript/TypeScript SDK for the [proof.holdings](https://proof.holdings) verification API.

## Installation

```bash
npm install @proof/sdk
```

## Quick Start

```typescript
import Proof from '@proof/sdk';

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

// Poll until complete
const result = await proof.verifications.waitForCompletion('verification_id', {
  interval: 3000,  // poll every 3s (default)
  timeout: 600000, // 10 min timeout (default)
});
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

// Offline validation (no API call — uses JWKS public keys)
const offline = await proof.proofs.verifyOffline(proofToken);
if (offline.valid) {
  console.log('Verified:', offline.payload?.type, offline.payload?.verified_at);
}

// Revoke a proof
await proof.proofs.revoke('verification_id', 'user_request');

// Get revocation list
const { revoked } = await proof.proofs.listRevoked();
```

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
import { Proof, ValidationError, RateLimitError, AuthenticationError } from '@proof/sdk';

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
});
```

## Requirements

- Node.js 18+ (uses native `fetch`)
- Or any environment with `fetch` available (Deno, Bun, browsers)

## License

MIT
