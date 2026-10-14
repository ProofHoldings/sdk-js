# Changelog

Notable changes to [`@proof-holdings/sdk`](https://www.npmjs.com/package/@proof-holdings/sdk).
Source: [ProofHoldings/sdk-js](https://github.com/ProofHoldings/sdk-js).

## 1.1.0 — 2026-10-14

The first release on npm.

### Added

- `new Proof()` without a key resolves one: a non-empty `PROOF_API_KEY`, else the entry that
  `npx @proof-holdings/mcp-server login` saved in `~/.proof-holdings/credentials` for the client's base
  URL. The base URL is the `baseUrl` option, else `PROOF_BASE_URL`, else `https://api.proof.holdings`.
  An explicit key behaves as before; an explicit empty key is an error.
- `proof.verifications.deleteDomainVerification(id)` deletes a domain verification attempt that is not
  verified (pending, verifying or failed). A verified domain is refused with 409 `domain_verified`.
- Types for account deletion and export, identifier, domain and project removal, the artifact claim
  lookup, and the Delegations section of a public profile.
- API-key listings carry `replaced_key_ids`: a key's usage covers every key it replaced.

### Changed

- The README's runtime line: Node.js 18 or later. The SDK imports `node:fs`, `node:os`, `node:path`
  and `node:zlib`, so it does not run in a browser.
