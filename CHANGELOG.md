# Changelog

Notable changes to [`@proof-holdings/sdk`](https://www.npmjs.com/package/@proof-holdings/sdk).
Source: [ProofHoldings/sdk-js](https://github.com/ProofHoldings/sdk-js).

## 1.2.0 — 2026-10-26

### Added

- SMS sessions: `sessions.create({ channel: 'sms' })` now works, the same way as SMS sign-in. The
  person texts a short code to one of our numbers; the session carries `sms_code`, `sms_message`
  and `sms_dids` (`SessionSmsNumber` per region, each with its own QR), and `deep_link` is an `sms:`
  link with the message pre-filled. An SMS proof carries `confidence: "standard"`.
- `CreateSessionParams.profile_id` names the sub-account a session is for; `Session.qr_text`.

- Message templates belong to a project (sub-account). Every `templates` method except `getDefaults`
  takes an optional last argument `{ profileId }` (`TemplateProjectOptions`), sent as the `profile_id`
  query parameter. Omitted, a project-bound API key uses its own project and any other key the
  primary project; a project-bound key naming another project is refused with 403 `profile_mismatch`.
- `email_theme` and `support_email` on `Profile`, `CreateProfileParams` and `UpdateProfileParams`:
  email branding is set per project.
- `TemplateGetResponse` carries `scope` (`project` or `default`) and `profile_id`;
  `TemplateListResponse` and custom templates carry `profile_id`.

### Deprecated

- `CreateAuthorizationParams.business_name` and `CreateSessionParams.context` are marked
  `@deprecated`. The server ignores both: messages name the sub-account (for a consent request, the
  approval setup's).

- `profiles.listTemplates`, `updateTemplate`, `deleteTemplate` and `previewTemplate`. The server
  retired `/api/v1/me/profiles/{id}/templates` (410 `endpoint_retired`); use the `templates` methods
  with `{ profileId }`.

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
