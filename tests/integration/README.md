# JS SDK Integration Tests

Runs against a live proof.holdings API when `PROOF_BASE_URL` and `PROOF_API_KEY_TEST`
are set. Otherwise the tests exercise the SDK against a local mock fetch so CI
still reports real pass/fail on every PR and the suite mirrors the Go SDK scope:

- client construction and defaults
- resource surface (verifications, proofs, me, sessions, webhooks)
- error taxonomy (400/401/403/404/409/429/500, network, timeout)
- polling terminal-state handling
- SSE streaming frame parsing

Invoke: `npx vitest run --config vitest.integration.config.ts`
