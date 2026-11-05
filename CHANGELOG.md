# Changelog

Notable changes to [`@proof-holdings/sdk`](https://www.npmjs.com/package/@proof-holdings/sdk).
Source: [ProofHoldings/sdk-js](https://github.com/ProofHoldings/sdk-js).

## 1.4.0 — 2026-11-05

The signing-key rotation (#513), on top of 1.3.0. These are additions; nothing written for 1.3.0
stops working.

### Added

- `proofs.token(id)`, `proofs.listReissued({ since, page?, limit? })` and
  `proofs.delegationToken(handle)`: the token pull of the signing-key rotation
  (`GET /api/v1/proofs/{id}/token`, `GET /api/v1/proofs?reissued_since=`,
  `GET /api/v1/proofs/delegation-token/{handle}`, the last a public endpoint). A proof of one of the account's own verified assets is read by the signed-in owner: with a live API key `token` answers 403 `owner_session_required` whatever its status, `listReissued` leaves it out and no `proof.reissued` webhook names it. `token` reads the
  current token of a proof you own by its `ph_ctl_` handle, and a revoked or expired proof answers
  410 `proof_not_live`; `listReissued` lists your proofs re-issued at or after `since`, oldest
  first, as references; `delegationToken` reads the current token of an active delegation by its
  `ph_dlg_` handle. Types `ProofTokenPull`, `ReissuedProof`, `ReissuedProofList`,
  `ReissuedProofsParams` and `DelegationTokenPull`.
- `WebhookEventType` includes `proof.reissued` and `delegation.reissued`.

### Deprecated

- Delegation `scope` (delegation schema 2.0: a delegation carries no scope): `scope` on `Delegation` (so on
  every delegation response type) and on `PublicProfileDelegation` is the scope a delegation issued before
  schema 2.0 was stored with, otherwise `[]`; `CreateDelegationParams.scope` stays required as released (pass
  `[]`), and a value given is sent as is, ignored by the server and answered with a `Deprecation` header. Removed in the next major
  (`sdks/shared/NEXT_MAJOR.md`).

## 1.3.0 — 2026-11-03

### Added

- `billing.topUp({ auto_top_up: true })` and `billing.autoTopUp({ enabled: true })` now answer `403 owner_session_required`: switching automatic top-ups on charges the saved card later with no one present, so it is the account owner's act on the dashboard. Switching them off still works. Plain top-ups are unchanged.
- `SubscriptionResponse` gains `scheduled_plan` (`BillingPlan | null`) and `scheduled_change_at` (`string | null`), both optional: the plan a downgrade made on the billing page moves the account to at the end of the paid period, and when. Absent from an API that predates plan changes.
- `billing` resource: `subscription()`, `checkout(params)`, `portal(params)`, `topUp(params)`, `balance()`, `balanceLedger(params?)` and `autoTopUp(params)` over `/api/v1/billing/*` — the subscription, Stripe checkout and portal links, and the prepaid balance. `topUp` and `autoTopUp` take the amount as the number `10`, `50` or `200` (euros). Their redirect URLs must be on `proof.holdings` (or `localhost`): the API refuses any other host. The four writes are refused to a key bound to one sub-account (`403 account_key_required`). Types `BillingPlan`, `SubscriptionStatus`, `SubscriptionResponse`, `CheckoutRequest`, `CheckoutResponse`, `PortalRequest`, `PortalResponse`, `TopUpAmount`, `TopUpRequest`, `TopUpResponse`, `AutoTopUpRequest`, `BalanceResponse`, `LedgerEntry`, `LedgerListResponse`, `BalanceLedgerParams`.
- `BalanceEmptyError` (402 `balance_empty`), with `topUpUrl`, `used`, `included` and `balance` (euro cents). Once billing is live, any method that creates a proof request can throw it when the plan's included proofs are used and the prepaid balance is empty; proofs already issued keep working. `ApiError` gained the four optional fields.
- `BillingUnavailableError` (503 `billing_unavailable`), a `ServerError`: checkout, portal and top-up while billing is not live.
- `HitlKeysResponse` gains `wrapped_dek`, `dek_iv`, `dek_tag`, `backup_wrapped_dek`, `backup_dek_iv` and
  `backup_dek_tag` (`string | null`, optional): the per-config data key wrapped under the master key and under the
  recovery key, which `hitlKeys.get()` already returned to a caller with `hitl:read`. Absent for a key holding only
  `confirmations:create`, and from an API that predates them.
- `confirmations.createAndWait()` throws `ProofError` with code `hitl_public_key_unreadable` ("this HITL config has no
  readable public key"), creating nothing, when the keys read answers `public_key: null` — the API's answer when the
  stored key material cannot be read. It used to fail inside the encryption with a `TypeError`.
- `WebhookDelivery.token_omitted_reason` (`'source_gone' | 'token_absent' | 'token_changed' | null`, optional): why the
  last send carried `proof_token: null`. A delivery's stored `payload` now holds every `proof_token` as null — the body
  POSTed to the receiver still carries the token. Webhook receivers: a retried delivery carries the same `proof_token` as the first attempt, or `proof_token: null` with `token_omitted_reason` ∈ {`source_gone`, `token_absent`, `token_changed`} — never a different token. Absent from an API that predates it.
- `confirmations.verifyDecisionSignature(confirmation, publicKey)` checks the approver's own
  signature on a decision, locally, against the public key you hold: your HITL config's own key for an
  owner decision, the key you recorded when an approver enrolled for theirs. It answers `verified`,
  `unsigned` (no signed evidence), `key_mismatch` (the decision carries another key), `input_mismatch`
  (the signed input names another confirmation, action or comment) or `signature_invalid`. The key is
  required: a key the server sent is no evidence against the server. Type `DecisionSignatureOutcome`.
  The key must be an RSA public key PEM (`PUBLIC KEY` or `RSA PUBLIC KEY`) with a 4096- to 16384-bit
  modulus and an odd exponent from 3 to 2^31 - 1; any other key answers `signature_invalid`.
- `webhookEndpoints` resource: `list()`, `create(params)`, `retrieve(id)`, `update(id, params)`,
  `delete(id)` and `rotateSecret(id)` over `/api/v1/webhook-endpoints`. Each endpoint has its own
  event subscription, scope (`all`, or `selected` with `profile_ids`) and signing secret. The secret
  is returned once — by `create` and `rotateSecret` (`WebhookEndpointWithSecret`) — and reads carry
  `secret_set` only. Types `WebhookEndpoint`, `WebhookEndpointWithSecret`, `WebhookEndpointList`,
  `CreateWebhookEndpointParams`, `UpdateWebhookEndpointParams`, `WebhookEndpointScope`,
  `WebhookEndpointStatus`.
- `profiles.rotateCallbackSecret(profileId)` rotates a sub-account's callback signing secret (what
  signs its `callback_url` deliveries) and returns the new one once, as `CallbackSecret`
  (`profile_id`, `secret`).
- `confirmations.list()` takes `profile_id`: only that sub-account's confirmations (sent through its HITL configs or created by its API keys). A key bound to another sub-account is refused with `403 profile_mismatch`.
- `Template` carries `last_fallback_at` and `last_fallback_variables`: when a message last went out with the platform default instead of the template, because rendering it would have left a raw `{{variable}}`, and the variable names that caused it. Both are cleared when the template is saved again.
- `TemplateListResponse.sendable` (`TemplateSendablePair[]`): what is sent — each channel and message type some message is sent for, with the variables its sends fill. `TemplateSendWarning`, and `warnings` on `TemplateUpsertResponse` and `TemplatePreviewResponse`: a template that would never be sent as written is still saved (200, as before), and each warning says why — `template_not_sent` for a pair no message is sent for, `template_variable_not_filled` (with `variables`) for a variable that message never fills. `sendable` and `warnings` are optional: an API that predates them omits the fields, so read their absence as an empty list. The live template tests read `telegram/verification_request` instead of an SMS template, which is never sent.
- `PublicProofItem` and `ProfileOwnerLink` (the spec's names, as in the Go, PHP and Python SDKs): `Profile.public_proofs` is typed `PublicProofItem[]` (was `unknown[]`), its `type`, `mask_level` and `delegate_type` typed as the spec's unions (`'phone' | 'email' | 'domain' | 'social' | 'wallet' | 'telegram_bot' | 'delegation'`, `'full' | 'partial' | 'hidden'`, `'human' | 'ai_agent'`) and `Profile.custom_links` `ProfileOwnerLink[]`, a `CustomLink` with its stored `_id`, `is_visible` and `display_order`. `CustomLink` itself, which `UpdateProfileParams` takes, is unchanged.
- `Profile.proof_order` (`ProofOrder`, `'default' | 'owner'`, always present) and `PublicProfileView.leading_proof` (`PublicProfileLeadingProof`: `type` — `'phone' | 'email' | 'domain' | 'social' | 'wallet' | 'telegram_bot'` — `display_value` and `label`): who ordered a profile's proofs, and the asset a public profile leads with.
- `PhoneAddSession.channel` is typed `'telegram' | 'whatsapp' | 'sms'` and `EmailAddSession.channel` `'otp'`, the values the API declares for them.
- A confirmation carries `resends`: each "Send again" (`POST /api/v1/confirmations/{id}/resend`) with when it happened, whether a dashboard session or which API key asked, and the channels it went to (by authorization id or `owner`, never a phone number or link), the last 50 kept. Absent from an API that predates it.

### Changed

- `confirmations.approvalLink()` is documented as what it is: the HITL config owner's link, decided
  with the config's own key. It is not an approver's link; an approver's link goes only to their own
  channel, which `POST /api/v1/confirmations/{id}/resend` ("Send again") sends it to again. Every call returns the same owner link until "Send again" reaches the owner; "Send again" replaces it, and the next call returns a new one — the replaced owner link answers `410 approval_link_superseded`, as an approver's earlier links do once "Send again" reaches them. Calling it again cancels nothing.
- A `503 billing_unavailable` is no longer retried: it throws `BillingUnavailableError` after one request. Every other 5xx is retried as before. Before, a 402 threw a plain `ProofError`; it now throws `BalanceEmptyError`, which extends `ProofError`, so existing `catch` blocks still match.
- `verifications.submit()` is typed `Promise<Verification & SubmitChallengeResponse>`: the fields the server sends (`id`, `status`, `attempts`, `max_attempts`, plus `verified_at` and `proof` when the code was right, `message` and `attempts_remaining` when it was not) are now typed, and the released `Verification` half stays, so code written for 1.2.0 still compiles. The server never sends `Verification`'s other fields (`type`, `channel`, `identifier`, `created_at`). The next major narrows the type to `SubmitChallengeResponse` (listed in `sdks/shared/NEXT_MAJOR.md`). The request and the wire response are unchanged.
- `profiles.listTemplates`, `updateTemplate`, `deleteTemplate` and `previewTemplate`, and the `ProfileTemplate*` types only they use, are now documented as removed in the next major (`sdks/shared/NEXT_MAJOR.md`); the types are newly `@deprecated`. They still send the request, exactly as in 1.2.0, so a call fails with the server's answer: 410 `endpoint_retired`, naming the replacement, or the authentication or validation error that comes first.

### Fixed

- `proofs.verifyOffline()` refuses a correctly signed token that lacks the claims the issuer requires of a proof (a non-empty `type`, `channel` and `identifier_hash`, and a `user_id` or `tenant_id`), answering `valid: false` with `reason` `invalid`, as `POST /proofs/validate` does. It used to answer `valid: true` for anything signed with the proof key, including a data-export download receipt.
- `verifications.list({ channel })` filters by channel. The API used to drop the `channel` filter and return every channel; it now applies it, and refuses an unknown channel with `400 validation_error`.
- `verifications.waitForCompletion()` and `verifications.stream()` end on `cancelled`, the status of
  the losing channel in a multi-channel verification. They used to keep polling until the timeout.
- `PhoneAddSession`, `EmailAddSession` and `TwoFASession` (what `me.retrievePhoneAddSession()`, `me.retrieveEmailAddSession()` and `me.retrieve2FASession()` return) name the fields the server sends: `session_id`, plus `phone_number` / `email`, `channel`, `action_type`, `verified_at` and the grant fields. They declared `id`, which the server never sent; `id` stays, typed as before for 1.x compatibility and marked `@deprecated`, and is removed in the next major (listed in `sdks/shared/NEXT_MAJOR.md`).
- The `proofs.revoke()` doc comment names the five values the API accepts for `reason`: `user_request`, `fraud`, `key_compromise`, `asset_transferred` and `other`. Any other value is refused with `400 validation_error`; a `reason` left out (or empty) is not sent, and the API records `user_request`. A delegation proof (`ph_dlg_*`) refuses `asset_transferred`, as the comment also says. The parameter stays `string` through 1.x; narrowing it is listed in `sdks/shared/NEXT_MAJOR.md`.

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

- `authSessions.stream()`'s polling fallback ends on `completed_elsewhere`, a new terminal
  auth-session status: an email sign-in that the person finished in a different browser from the one
  that started it ("Sign in here" on the emailed link's page). That session never reaches `verified`
  and issues no cookies to the starter.

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
