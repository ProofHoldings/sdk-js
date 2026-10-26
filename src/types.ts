// ============================================================================
// Core Types
// ============================================================================

export type VerificationType = 'phone' | 'email' | 'domain' | 'social' | 'wallet' | 'account' | 'telegram_bot';

export type VerificationChannel =
  'whatsapp' | 'telegram' | 'sms'
  | 'email'
  | 'dns' | 'http' | 'auto'
  | 'github' | 'google' | 'facebook' | 'x' | 'linkedin' | 'instagram' | 'youtube' | 'tiktok'
  | 'ethereum' | 'solana' | 'bitcoin'
  | 'coinbase' | 'kraken'
  | 'telegram_bot_token';

export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired' | 'revoked' | 'cancelled';

export type SessionChannel = 'whatsapp' | 'telegram' | 'sms';

export type VerificationRequestStatus = 'pending' | 'partial' | 'completed' | 'expired' | 'cancelled';

export type ActionType = 'verification' | '2fa' | 'login' | 'custom' | 'confirmation' | 'authorization';

// ============================================================================
// API Response Envelope
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
  /** Seconds to wait before retrying (rate limit and lockout errors) */
  retryAfter?: number;
  /** Number of remaining attempts before lockout (auth endpoints only) */
  remaining_attempts?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  /** @deprecated Use total_pages. */
  pages: number;
}

export interface PaginatedList<T> {
  data: T[];
  pagination: Pagination;
}

// ============================================================================
// Verification
// ============================================================================

export interface ChallengeInstructions {
  /**
   * ABSENT for the pairs whose code we deliver out-of-band — `type: 'email'`, and `type: 'domain'`
   * with `channel: 'email'`. There the code (and the magic link) go to the mailbox and never to the
   * caller: the delivery is what the proof rests on, so holding the code would prove nothing.
   * Present for every other pair, which has to relay it (phone) or publish it (domain dns/http/auto).
   */
  code?: string;
  expires_at: string;
  instruction?: string;
  send_to?: string;
  send_to_formatted?: string;
  deep_link?: string;
  message?: string;
  record_type?: string;
  record_name?: string;
  record_value?: string;
  file_path?: string;
  file_content?: string;
  file_url?: string;
  method?: string;
  magic_link?: string;
  email_sent?: boolean;
  email_to?: string;
}

export interface ProofToken {
  token: string;
  expires_at: string;
  /** Present for SMS proofs: `standard`, or `degraded` once a later spoof check finds risk. */
  confidence?: 'high' | 'standard' | 'degraded';
}

export interface Verification {
  id: string;
  type: VerificationType;
  channel: VerificationChannel;
  status: VerificationStatus;
  /** Absent for an identifier-free phone verification, whose number is learned only on completion. */
  identifier?: string;
  attempts?: number;
  max_attempts?: number;
  challenge?: ChallengeInstructions;
  proof?: ProofToken;
  verified_at?: string;
  verified_data?: Record<string, unknown>;
  created_at: string;
}

export interface CreateVerificationParams {
  type: VerificationType;
  channel: VerificationChannel;
  identifier: string;
  external_user_id?: string;
  callback_url?: string;
  client_metadata?: Record<string, unknown>;
  dns_provider?: Record<string, string>;
  email_prefix?: string;
  bot_token?: string; // Required for channel='telegram_bot_token'
}

export interface ListVerificationsParams {
  status?: VerificationStatus;
  type?: VerificationType;
  channel?: VerificationChannel;
  limit?: number;
  page?: number;
}

export type MultiChannelPhoneChannel = 'whatsapp' | 'telegram' | 'sms';

export interface CreateMultiChannelVerificationParams {
  type: 'phone';
  identifier: string;
  channels: MultiChannelPhoneChannel[];
  external_user_id?: string;
  client_metadata?: Record<string, unknown>;
  proof_expiry_days?: number;
}

export interface MultiChannelChannelBlock {
  channel: MultiChannelPhoneChannel;
  verification_id: string;
  status: VerificationStatus;
  deep_link?: string;
  qr_code?: string;
  qr_text?: string;
  message?: string;
  instructions?: string;
  phone_number?: string;
  sms_message?: string;
  sms_dids?: Record<string, unknown>;
  suggested_region?: 'americas' | 'europe' | 'israel';
}

export interface MultiChannelVerificationResponse {
  group_id: string;
  type: 'phone';
  identifier: string;
  status: VerificationStatus;
  expires_at: string;
  external_user_id?: string;
  client_metadata?: Record<string, unknown>;
  channels: MultiChannelChannelBlock[];
  created_at: string;
}

export interface MultiChannelGroupStatusResponse {
  group_id: string;
  status: 'pending' | 'verified' | 'expired';
  winning_channel: MultiChannelPhoneChannel | null;
  channels: Array<{
    channel: MultiChannelPhoneChannel;
    verification_id: string;
    status: VerificationStatus;
  }>;
  proof?: ProofToken;
}

// ============================================================================
// Verification Requests (Multi-Asset)
// ============================================================================

export interface RequestedAsset {
  type: VerificationType;
  identifier?: string | null;
  channel?: VerificationChannel | null;
  allowed_channels?: VerificationChannel[];
  required?: boolean;
}

export interface VerificationRequestAsset extends RequestedAsset {
  status?: string;
  verification_id?: string;
  proof_token?: string;
  verified_at?: string;
  verified_identifier?: string;
  verified_channel?: VerificationChannel;
}

/**
 * Additive machine-readable effective state on a verification request. Re-derives
 * expiry from `expires_at` (never trusts the stored status); present only on
 * authenticated owner/requester responses.
 */
export interface ComputedState {
  status: VerificationRequestStatus;
  is_expiring_soon: boolean;
  next_action: {
    code: string;
    role: 'requester' | 'recipient';
    label: string;
  };
}

export interface VerificationRequest {
  id: string;
  reference_id?: string;
  status: VerificationRequestStatus;
  /** Additive effective-state envelope (authenticated owner/requester only). */
  computed_state?: ComputedState;
  action_type: ActionType;
  action_context?: Record<string, unknown> | null;
  assets: VerificationRequestAsset[];
  partial_ok?: boolean;
  validity_requirement?: string | null;
  verification_url: string;
  redirect_url?: string | null;
  callback_url?: string | null;
  expires_at: string;
  completed_at?: string;
  created_at: string;
}

/** A verification request as `list()` returns it: a summary — `retrieve()` it for its assets. */
export interface VerificationRequestListItem {
  id: string;
  reference_id?: string;
  status: VerificationRequestStatus;
  computed_state: ComputedState;
  action_type: ActionType;
  asset_count: number;
  progress: {
    completed: number;
    completed_required: number;
    required: number;
    total: number;
  };
  expires_at: string;
  completed_at?: string;
  created_at: string;
}

export interface CancelVerificationRequestResponse {
  id: string;
  status: 'cancelled';
  message: string;
}

export interface CreateVerificationRequestParams {
  assets: RequestedAsset[];
  reference_id?: string;
  action_type?: ActionType;
  action_context?: Record<string, unknown>;
  partial_ok?: boolean;
  validity_requirement?: string;
  redirect_url?: string;
  callback_url?: string;
  /** Expiry in seconds (default: 604800 = 7 days, max: 2592000 = 30 days) */
  expires_in?: number;
  public_profile_id?: string;
}

export interface ListVerificationRequestsParams {
  /**
   * Status filter. `active` is a synthetic, query-only alias for live (not-yet-expired)
   * pending or partial requests; the persisted statuses are time-aware on the server.
   */
  status?: VerificationRequestStatus | 'active';
  reference_id?: string;
  limit?: number;
  page?: number;
}

// ============================================================================
// Resend
// ============================================================================

export interface ResendResponse {
  success: boolean;
  message: string;
  expires_at: string;
}

// ============================================================================
// Test Verify
// ============================================================================

export interface TestVerifyResponse {
  id: string;
  type: VerificationType;
  channel: VerificationChannel;
  status: VerificationStatus;
  identifier: string;
  verified_at?: string;
  proof_token?: string;
  proof_expires_at?: string;
  test_mode: boolean;
}

// ============================================================================
// Domain Verification
// ============================================================================

export interface StartDomainVerificationParams {
  domain: string;
  customer_id?: string;
  verification_method?: 'manual_dns' | 'http_file';
}

export interface DomainVerification {
  id: string;
  domain: string;
  status: string;
  verification_method?: string;
  dns_record?: {
    type: string;
    name: string;
    value: string;
  };
  http_file?: {
    path: string;
    content: string;
  };
  provider?: {
    detected: string;
    name: string;
  };
  verified_at?: string;
}

export interface DomainCheckResponse {
  id: string;
  domain: string;
  status: string;
  verified?: boolean;
  verified_at?: string;
  check_count?: number;
}

// ============================================================================
// Verified Users
// ============================================================================

export interface VerifiedUserVerification {
  id: string;
  type: VerificationType;
  channel: VerificationChannel;
  identifier: string;
  status?: VerificationStatus;
  verified_at?: string;
  has_proof?: boolean;
  proof_expires_at?: string;
  created_at?: string;
}

export interface VerifiedUser {
  external_user_id: string;
  verification_count: number;
  types_verified: VerificationType[];
  verifications: VerifiedUserVerification[];
  first_verified_at?: string;
  last_verified_at?: string;
}

export interface ListVerifiedUsersParams {
  page?: number;
  limit?: number;
}

// ============================================================================
// Proofs
// ============================================================================

export interface ProofStatus {
  proof_id: string;
  /** A live proof reads `active`; `suspended` is the reversible pause (schema 1.3+ servers). */
  status: string;
  is_valid: boolean;
  is_revoked: boolean;
  revoked_at?: string;
  revoked_reason?: string;
  /** When the current suspension began; null/absent unless status is `suspended`. */
  suspended_at?: string | null;
  expires_at?: string;
  is_expired: boolean;
  verified_at?: string;
}

export interface ProofValidation {
  valid: boolean;
  reason?: string;
  message?: string;
  /** Stable public handle of the proof (`ph_ctl_…`), when it is registered. */
  proof_id?: string;
  verification?: {
    id: string;
    /** What the proof proves: an asset (a verification type), or a `confirmation` / `authorization` decision. */
    type: VerificationType | 'confirmation' | 'authorization';
    /** `browser` for a confirmation approved on the approval page. */
    channel: VerificationChannel | 'browser';
    /** SHA-256 of the verified identifier — compare with your own hash of the value you expect. */
    identifier_hash: string;
    verified_at: string;
    expires_at: string;
    /** Present on `confirmation` and `authorization` proofs only. */
    decision?: 'approve' | 'deny';
  };
  revoked_at?: string;
  revoked_reason?: string;
  /** When the suspension began — present only with reason `suspended`. */
  suspended_at?: string;
}

/** Collection a revoked proof was issued from — a proof does not have to come from a verification. */
export type RevokedProofType =
  | 'verification'
  | 'verification_request'
  | 'confirmation'
  | 'authorization'
  | 'user_asset';

export interface RevokedProof {
  /**
   * The `sub` claim carried by the proof token — match it against `payload.sub` offline.
   * Null when that `sub` is shared with a still-live proof; match on `public_proof_id` instead.
   */
  proof_id: string | null;
  /** Stable public handle of the same proof, or null for a proof issued before the registry. */
  public_proof_id: string | null;
  proof_type: RevokedProofType;
  revoked_at: string | null;
  reason?: string | null;
}

export interface RevocationList {
  revoked: RevokedProof[];
  issued_at: string;
  count: number;
  /**
   * True when the list was truncated at the server cap and may be incomplete — re-baseline and
   * prefer the Token Status List at `status_list_uri`, which never truncates. Absent on servers
   * older than schema 1.3.
   */
  has_more?: boolean;
  /** The Token Status List endpoint (IETF draft-ietf-oauth-status-list). */
  status_list_uri?: string;
  signature: string | null;
  kid: string | null;
}

export interface RevokeResponse {
  success: boolean;
  /** Public proof handle — present when the proof was addressed by `ph_ctl_*`/`ph_dlg_*`. */
  proof_id?: string;
  /** Which record carries the proof (`verification`, `user_asset`, `delegation`, …). Handle path only. */
  proof_type?: string;
  /** Present only when the revoked proof belongs to a verification. */
  verification_id?: string;
  revoked_at: string;
  reason: string;
}

// ============================================================================
// Sessions (Phone-First Flow)
// ============================================================================

/** One of our SMS numbers, for one region: an `sms` session's code is texted to it. */
export interface SessionSmsNumber {
  did: string;
  label: string;
  flag: string;
  /** Opens the messaging app on this number with the message pre-filled. */
  qr_code?: string;
  qr_text?: string;
}

export interface Session {
  id: string;
  channel: SessionChannel;
  status: VerificationStatus;
  deep_link?: string;
  qr_code?: string;
  qr_text?: string;
  instructions?: string;
  /** `sms` only: the short code the person texts. */
  sms_code?: string;
  /** `sms` only: the message to send, as pre-filled in the links. */
  sms_message?: string;
  /** `sms` only: every number the code can be texted to, one per configured region. */
  sms_dids?: {
    americas: SessionSmsNumber;
    europe?: SessionSmsNumber;
    israel?: SessionSmsNumber;
  };
  phone_number?: string;
  verified_at?: string;
  verification_id?: string;
  proof?: ProofToken;
  expires_at: string;
  created_at?: string;
}

export interface CreateSessionParams {
  channel: SessionChannel;
  /**
   * The sub-account (project) this session is for: its branding and templates are used. Omitted:
   * the API key's sub-account, else your primary.
   */
  profile_id?: string;
  client_metadata?: Record<string, unknown>;
  context?: {
    /**
     * @deprecated Ignored by the server: the bot copy names the session's sub-account
     * (`profile_id`, else the API key's, else the primary).
     */
    business_name?: string;
    /** Picks the bot's wording: log in, 2FA, account recovery, or plain verification (the default). */
    action?: 'login' | '2fa' | 'verification' | 'recovery';
  };
}

// ============================================================================
// Webhook Deliveries
// ============================================================================

/**
 * Webhook event types the platform delivers. Mirrors the backend OpenAPI
 * `WebhookEventType` enum (`src/openapi/schemas.ts`).
 */
export type WebhookEventType =
  | 'verification_request.completed'
  | 'verification_request.partial'
  | 'verification_request.expired'
  | 'verification.completed'
  | 'confirmation.approved'
  | 'confirmation.denied'
  | 'authorization.approved'
  | 'authorization.denied'
  | 'proof.revoked'
  | 'proof.suspended'
  | 'proof.unsuspended'
  | 'account.deletion_scheduled'
  | 'account.deletion_cancelled';

export interface WebhookDelivery {
  id: string;
  url: string;
  event_type: WebhookEventType;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  max_attempts: number;
  response_status: number | null;
  error_message: string | null;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  delivered_at: string | null;
  verification_request_id: string | null;
  payload?: unknown;
  response_body?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface WebhookRetryResponse {
  success: boolean;
  message: string;
  delivery_id: string;
  next_retry_at: string;
}

export interface WebhookDeliveryList {
  data: WebhookDelivery[];
  /** @deprecated Use data. */
  deliveries: WebhookDelivery[];
  pagination: WebhookPagination;
}

export interface WebhookPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface WebhookDeliveryStats {
  total: number;
  by_status: {
    pending: number;
    delivered: number;
    failed: number;
  };
  delivery_rate: string;
  recent_failures_24h: number;
}

// ============================================================================
// Account / Me Resources
// ============================================================================

/** Query params accepting an environment override (`production` | `test`). */
export interface MeEnvironmentParams {
  /** Scope metrics to test or production data (default: production). */
  environment?: 'production' | 'test';
}

/**
 * One-call account snapshot (`GET /me/summary`) — the same data the dashboard
 * home renders. Nested objects are intentionally loose; see the API reference
 * for the full `quota` / `request_health` / `top_channels` shapes.
 */
export interface PlatformSummary {
  as_of: string;
  cache_age_seconds: number;
  quota: Record<string, unknown>;
  request_health: Record<string, unknown>;
  top_channels: Array<Record<string, unknown>>;
  channels_with_zero_completions: string[];
  /** Present only when the caller has the `hitl:read` scope. */
  hitl_channels?: Record<string, unknown>;
  active_api_keys: number;
  next_action: Record<string, unknown> | null;
}

/** One of the six search buckets (`GET /me/search` `?type=`). */
export type MeSearchBucket =
  | 'verification_requests'
  | 'verifications'
  | 'hitl'
  | 'confirmations'
  | 'authorizations'
  | 'api_keys';

export interface MeSearchParams {
  /** Prefix-anchored, case-sensitive query (min 3 chars). */
  q: string;
  /** Narrow the search to a single bucket. */
  type?: MeSearchBucket;
  environment?: 'production' | 'test';
  /** Max results per bucket (default 10, max 25). */
  limit?: number;
}

/** Global account search results (`GET /me/search`). */
export interface MeSearchResults {
  data: {
    verification_requests: Array<Record<string, unknown>>;
    verifications: Array<Record<string, unknown>>;
    hitl: Array<Record<string, unknown>>;
    confirmations: Array<Record<string, unknown>>;
    authorizations: Array<Record<string, unknown>>;
    api_keys: Array<Record<string, unknown>>;
  };
  /** Sum of all bucket lengths. */
  total: number;
}

/** Redacted API-key metadata — never includes the key hash or full secret. */
export interface ApiKeyMetadata {
  id: string;
  name: string;
  key_prefix: string;
  environment: string;
  scopes: string[];
  /** Sub-account (PublicProfile) the key is bound to; null for unbound keys. */
  profile_id: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  /**
   * Ids of the keys this key replaced, newest first (it was regenerated through
   * `POST /me/api-keys/:id/regenerate` or renewed by an MCP sign-in refresh). Their requests and
   * usage count as this key's.
   */
  replaced_key_ids?: string[];
  created_at: string;
}

/** Per-API-key usage counts plus attribution context (`GET /me/api-keys/:id/usage`). */
export interface ApiKeyUsage {
  api_key: ApiKeyMetadata;
  verifications: {
    total: number;
    by_type: Record<string, number>;
    by_channel: Record<string, number>;
    by_status: Record<string, number>;
  };
  verification_requests: { total: number; by_status: Record<string, number> };
  confirmations: { total: number; by_status: Record<string, number> };
  authorizations: { total: number; by_status: Record<string, number> };
  /** Earliest UTC-day-floored attributed timestamp, or null if none. */
  attribution_cutoff_at: string | null;
  /** Fraction of in-scope verifications attributed to any key, or null. */
  attributed_fraction: number | null;
}

export interface ListWebhookDeliveriesParams {
  status?: string;
  event_type?: string;
  verification_request_id?: string;
  limit?: number;
  page?: number;
}

// ============================================================================
// Offline Verification
// ============================================================================

/**
 * Why an offline verification answered `valid: false`. The names are the issuer's own — the same
 * values `POST /api/v1/proofs/validate` returns in its `reason` field — so a caller branching on
 * them does not need two vocabularies for the online and the offline path.
 *
 * `status_unavailable` means the revocation status could NOT be read (unreachable list, a list
 * that failed its own checks, a slot the list does not cover). It is not a claim that the proof
 * is withdrawn; it is the refusal to guess.
 */
export type OfflineFailureReason =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'suspended'
  | 'status_unavailable'
  /** The issuer revoked the key that signed this token; `pull_hint` says where to fetch a re-issued one. */
  | 'key_revoked'
  /** The key set could not be refreshed and the cached copy is older than `maxJwksAgeMs`; see `cache_age_seconds`. */
  | 'jwks_stale'
  /** The signing key belongs to another token family (a proof key signing a delegation, say). */
  | 'wrong_key_purpose'
  /** The token's `iat` lies outside its signing key's validity window. */
  | 'outside_key_window'
  /** The token's `exp` lies beyond `iat` plus its signing key's maximum token lifetime. */
  | 'token_lifetime_exceeded'
  /** No key the issuer publishes matches this token's `kid`, even after a refetch. */
  | 'unknown_key';

/** Where a token signed by a revoked key can be fetched again, re-signed. */
export interface OfflinePullHint {
  /** The configured issuer's origin. */
  issuer_origin: string;
  /** The token's handle: `proof_id` for a proof, `sub` for a delegation. */
  handle: string | null;
}

export interface OfflineVerificationResult {
  valid: boolean;
  payload?: {
    iss: string;
    sub: string;
    iat: number;
    exp: number;
    type: string;
    channel: string;
    identifier_hash: string;
    verified_at: string;
    user_id: string;
    decision?: 'approve' | 'deny';
  };
  error?: string;
  reason?: OfflineFailureReason;
  /** With `reason: 'key_revoked'`. */
  pull_hint?: OfflinePullHint;
  /** With `reason: 'jwks_stale'`: the age of the cached key set, or null when it is unknown. */
  cache_age_seconds?: number | null;
  /**
   * Whether the proof's revocation status was actually established during this call. False when
   * the token carries no status-list slot, when the check was turned off, and whenever the
   * verification failed before the list could be consulted — so a caller can never mistake "not
   * checked" for "checked and clear".
   */
  revocation_checked: boolean;
}

/** Options for {@link Proofs.verifyOffline}. */
export interface OfflineVerificationOptions {
  /**
   * Check the issuer's status list for a revoked or suspended proof. Default TRUE: the method
   * already fetches the public key set over the network, and the status list is the same kind of
   * public, cacheable artifact — it reveals nothing about which proof is being checked.
   *
   * Set it to false only when the signature alone is the question (an air-gapped check against a
   * warm key cache, say); the result then reports `revocation_checked: false`.
   */
  checkRevocation?: boolean;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface ProofOptions {
  /** Omit it to resolve the key: PROOF_API_KEY, then ~/.proof-holdings/credentials for this base URL. */
  apiKey?: string;
  /** Explicit, else a non-empty PROOF_BASE_URL, else `https://api.proof.holdings`. */
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
  /**
   * How old the cached issuer key set may grow, while it cannot be refreshed, before offline
   * verification answers `jwks_stale` instead of trusting it. Whole milliseconds, default 24 hours,
   * at most 25 days — the constructor throws otherwise.
   */
  maxJwksAgeMs?: number;
}

// ============================================================================
// Polling
// ============================================================================

export interface WaitOptions {
  /** Initial poll interval in milliseconds (default: 2000) */
  interval?: number;
  /** Timeout in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number;
  /** Backoff multiplier applied after each poll (default: 1.5) */
  backoff?: number;
  /** Maximum poll interval in milliseconds (default: 30000) */
  maxInterval?: number;
  /** Maximum random jitter added to each poll in milliseconds (default: 500) */
  jitter?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/** Options for `confirmations.waitForResolution` and `confirmations.createAndWait`. */
export interface ConfirmAndWaitOptions extends WaitOptions {
  /** Per-request proof expiry override in days, passed to confirmation create (7, 30, 90, or 365) */
  proofExpiryDays?: number;
  /**
   * Throw `ConfirmationDeniedError` when the confirmation is denied.
   * Default: `false` for `waitForResolution` (returns the denied confirmation),
   * `true` for `createAndWait` (gate semantics — denial surfaces as an error).
   */
  throwOnDenial?: boolean;
}

// ============================================================================
// HITL Encryption Keys
// ============================================================================

/** Response from `GET /api/v1/hitl/:id/keys`. */
export interface HitlKeysResponse {
  public_key: string;
  encrypted_private_key: string;
  kdf_salt: string;
  kid: string;
}

/** Body accepted by `PUT /api/v1/hitl/:id/keys`. */
export interface HitlKeysPutParams {
  public_key: string;
  encrypted_private_key: string;
  kdf_salt: string;
}

/** Response from `PUT /api/v1/hitl/:id/keys`. */
export interface HitlKeysPutResponse {
  kid: string;
  message: string;
}

/** Response from `DELETE /api/v1/hitl/:id/keys`. */
export interface HitlKeysDeleteResponse {
  message: string;
}

/** An enrolled approver's public key, for multi-recipient (v2) envelope wrapping. */
export interface HitlApproverKey {
  authorization_id: string;
  recipient: string;
  channel: string;
  public_key: string;
  kid: string;
}

export interface HitlApproverKeysResponse {
  approver_keys: HitlApproverKey[];
}

// ============================================================================
// HITL Configs
// ============================================================================

export type HitlStatus = 'pending' | 'active' | 'archived';

/** A messaging channel configured for HITL approvals. */
export type HitlChannel =
  | { type: 'telegram'; config: { chat_id: string } }
  | { type: 'whatsapp'; config: { phone_number?: string; bsuid?: string } };

/** HITL configuration with messaging channels and timeout. */
export interface HitlConfig {
  id: string;
  /** Owner user ID (useful for SDK encryption AAD) */
  user_id: string | null;
  name?: string | null;
  profile_id?: string | null;
  /** Backing Circle for a circle-backed Approvals config (null for channel-list configs) */
  circle_id?: string | null;
  channels: HitlChannel[];
  timeout_seconds: number;
  status: HitlStatus;
  /** Encryption keypair metadata (null if not configured) */
  keypair: { kid: string; has_encrypted_private_key: boolean } | null;
  environment: 'production' | 'test';
  created_at: string;
  updated_at: string;
}

export interface CreateHitlParams {
  /** Name for this HITL configuration */
  name: string;
  /** At least one messaging channel for approvals */
  channels: HitlChannel[];
  /** Default timeout in seconds for confirmations (60–86400, server default 3600) */
  timeout_seconds?: number;
  /** Optional public profile for branded messages (caller must own it) */
  profile_id?: string;
}

export interface UpdateHitlParams {
  name?: string | null;
  channels?: HitlChannel[];
  timeout_seconds?: number;
}

export interface HitlListParams {
  page?: number;
  limit?: number;
  status?: HitlStatus;
  environment?: 'production' | 'test';
  [key: string]: string | number | boolean | undefined;
}

export interface HitlListResponse {
  data: HitlConfig[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  /**
   * The plan's cap on active configs (`null` when unlimited) and the account's active count across
   * every environment and profile — what creating a config is checked against, whatever the list
   * itself is filtered to.
   */
  limits: { max_active_configs: number | null; active_configs: number };
}

/** One per-channel result from authorization consent dispatch. */
export interface HitlAuthorizationResult {
  channel: string;
  /** Channel recipient (chat_id, phone number, or BSUID) */
  recipient: string;
  authorization_id: string;
  status: string;
}

/** Response from `POST /api/v1/hitl/:id/authorize`. */
export interface HitlAuthorizationResponse {
  hitl_id: string;
  authorizations: HitlAuthorizationResult[];
  message: string;
}

/** Response from `POST /api/v1/hitl/:id/finalize` (pending → active). */
export interface HitlFinalizeResponse extends HitlConfig {
  /** Authorization consent dispatch results (present when consent messages were sent) */
  authorizations?: HitlAuthorizationResult[];
}

/** Response from `POST /api/v1/hitl/chat-id-discovery`. */
export interface ChatIdDiscoveryCreateResponse {
  token: string;
  deep_link: string;
  /** QR code data URL for the deep link */
  qr_code: string;
  /** UTF-8 text representation of the QR code for terminal/agent display */
  qr_text: string;
  expires_in: number;
}

/** Response from `POST /api/v1/confirmations/:id/approval-link`. */
export interface ApprovalLinkResponse {
  approval_url: string;
}

/** One proof entry from `GET /api/v1/verification-requests/:id/proofs`. */
export interface VerificationRequestProof {
  type: VerificationType;
  identifier?: string;
  channel?: VerificationChannel;
  proof_token: string;
  verified_at?: string;
}

export interface VerificationRequestProofsResponse {
  proofs: VerificationRequestProof[];
}

// ============================================================================
// Circles (people-primitive)
// ============================================================================

export type CircleStatus = 'active' | 'archived';
export type CircleMemberStatus = 'pending' | 'active';
export type CircleMemberChannelType = 'telegram' | 'whatsapp';
export type CircleMemberChannelStatus = 'declared' | 'verified';

/**
 * A Circle member — channel presence booleans and a masked enrollment phone only, never an
 * identifier (SEC-PM-006).
 */
export interface CircleMember {
  id: string;
  name: string;
  status: CircleMemberStatus;
  has_telegram: boolean;
  has_whatsapp: boolean;
  mesh_opted_in: boolean;
  mesh_opt_out: boolean;
  /** Masked phone the contact proved at enrollment (`+9••••••4171`); null until they enroll. */
  enrolled_phone_hint: string | null;
  enrolled_at: string | null;
  last_verified_at: string | null;
}

/** A Circle — a named group of trusted contacts. */
export interface Circle {
  id: string;
  user_id: string | null;
  name: string | null;
  /** How this Circle's members know its owner; null when unset */
  owner_name: string | null;
  profile_id: string | null;
  environment: 'production' | 'test';
  proof_me_enabled: boolean;
  status: CircleStatus;
  member_count: number;
  members: CircleMember[];
  created_at: string;
  updated_at: string;
}

export interface CircleListResponse {
  data: Circle[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

/** A member to create inline with a Circle (name + optional declared channels). */
export interface CircleMemberInput {
  name: string;
  /** Optional pre-declared Telegram chat id (usually captured at enrollment instead) */
  telegram_chat_id?: string;
  /** Optional pre-declared WhatsApp phone in E.164 (leading +) */
  whatsapp_phone?: string;
}

export interface CreateCircleParams {
  name: string;
  /** How this Circle's members know its owner ("Dad"); the bots name nobody while it is unset */
  owner_name?: string | null;
  /** Optional public profile to bind for branded messages (create-only; caller must own it) */
  profile_id?: string;
  /** Opt this Circle into Proof-Me drills */
  proof_me_enabled?: boolean;
  members?: CircleMemberInput[];
}

export interface UpdateCircleParams {
  name?: string;
  /** How this Circle's members know its owner; null or an empty string clears it */
  owner_name?: string | null;
}

export interface CircleListParams {
  page?: number;
  limit?: number;
  status?: CircleStatus;
  environment?: 'production' | 'test';
  profile_id?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface CircleMemberListResponse {
  members: CircleMember[];
}

export interface CreateCircleMemberParams {
  name: string;
  /** Optional pre-declared WhatsApp phone in E.164 (leading +); Telegram is captured at enrollment */
  whatsapp_phone?: string;
}

/** Response from `POST /api/v1/circles/:id/members/invite` (a single-use member enrollment link). */
export interface CircleMemberInviteResponse {
  token: string;
  member_id: string;
  telegram_deep_link: string;
  whatsapp_deep_link: string;
  /** QR code data URL for the primary deep link */
  qr_code: string;
  /** UTF-8 text representation of the QR code */
  qr_text: string;
  expires_in: number;
  suggested_share_text: string;
}

/** Response from `POST /api/v1/circles/:id/members/:memberId/drill`. */
export interface CircleMemberDrillResponse {
  id: string;
  status: 'pending';
  confirm_channel?: string;
  single_channel_warning?: boolean;
}

export interface AddCircleMemberChannelParams {
  channel: CircleMemberChannelType;
  /** The Telegram chat id (≤50) or E.164 WhatsApp phone (leading +) — validated per channel */
  identifier: string;
}

/** A member channel — metadata only, never the identifier (SEC-PM-006). */
export interface CircleMemberChannel {
  id: string;
  channel: CircleMemberChannelType;
  status: CircleMemberChannelStatus;
  verified_at: string | null;
  created_at: string;
}

export interface CircleMemberChannelListResponse {
  channels: CircleMemberChannel[];
}

// ============================================================================
// Delegations (Proof of Delegation)
// ============================================================================

export type DelegateIdentifierType = 'url' | 'purl';
export type DelegationStatus = 'active' | 'revoked';
export type DelegationEffectiveStatus = 'active' | 'revoked' | 'expired' | 'suspended';
export type RevokeDelegationReason = 'user_request' | 'fraud' | 'key_compromise' | 'other';

/** A typed artifact identifier — an https URL or a package URL (purl). */
export interface DelegateIdentifier {
  type: DelegateIdentifierType;
  value: string;
}

/**
 * A delegation attests that whoever controls the `principal` domain authorized the
 * `delegate` artifact for the listed scopes — nothing more. It says nothing about
 * the artifact or the business behind it.
 *
 * NO method returns this shape. Every delegation response also carries the derived
 * `effective_status`/`is_valid`, so what you receive is `DelegationListItem` (list, revoke)
 * or `DelegationDetail` (create, retrieve). Exported as a back-compat type only.
 */
export interface Delegation {
  id: string;
  /** Public handle (`ph_dlg_<32 hex>`) — accepted by the public proof status lookup */
  delegation_id: string | null;
  /** The control-proven domain (derived server-side from the control proof, never client input) */
  principal: string;
  delegate: DelegateIdentifier;
  scope: string[];
  /** Public handle (`ph_ctl_<32 hex>`) of the domain control proof this delegation chains down to */
  control_proof: string;
  status: DelegationStatus;
  revoked_at: string | null;
  revoked_reason: string | null;
  environment: 'production' | 'test';
  issued_at: string;
  expires_at: string;
  created_at: string;
}

/**
 * The delegation plus the publishable signed token.
 *
 * NO method returns this shape either — it was the create-201 body until the derived pair
 * landed on the writes; `create` and `retrieve` now answer `DelegationDetail`. Exported as a
 * back-compat type only.
 */
export interface DelegationWithToken extends Delegation {
  token: string | null;
}

/**
 * The LIST shape — the stored record plus the status DERIVED at read time.
 *
 * Render `effective_status`, not `status`: `status` is only whether the owner revoked the
 * delegation themselves, so a delegation still reads `active` there once its domain control
 * proof was revoked, suspended or expired — and once its OWN lifetime ran out — while every
 * verifier already rejects it. `effective_status` covers both clocks: a delegation is never
 * valid for longer than `min(its own expires_at, the control proof's)`.
 */
export interface DelegationListItem extends Delegation {
  effective_status: DelegationEffectiveStatus;
  is_valid: boolean;
}

/** The retrieve shape — stored token plus the same derived status the list carries. */
export interface DelegationDetail extends DelegationWithToken {
  effective_status: DelegationEffectiveStatus;
  is_valid: boolean;
}

export interface CreateDelegationParams {
  /** Public handle (`ph_ctl_<32 hex>`) of YOUR active domain control proof */
  control_proof: string;
  delegate: DelegateIdentifier;
  /** 1–32 capability scopes (pattern tokens, ≤64 chars each) */
  scope: string[];
  /** Lifetime in seconds — rejected (400), never truncated, when it exceeds the control proof's remainder */
  expires_in?: number;
}

export interface DelegationListParams {
  page?: number;
  limit?: number;
  /**
   * Filters the delegation's OWN stored record, not the derived `effective_status` — that
   * cascade spans two collections and cannot be filtered server-side without breaking
   * pagination. `status: 'active'` therefore still returns a delegation whose control proof
   * died, and one that simply ran out; read `effective_status` on each item.
   */
  status?: DelegationStatus;
  [key: string]: string | number | boolean | undefined;
}

export interface DelegationListResponse {
  data: DelegationListItem[];
  pagination: { page: number; limit: number; total: number };
}

export interface RevokeDelegationParams {
  reason?: RevokeDelegationReason;
}

// ============================================================================
// Authorizations
// ============================================================================

export type AuthorizationStatus = 'pending' | 'active' | 'revoked' | 'denied' | 'expired';

export type AuthorizationChannel = 'telegram' | 'whatsapp' | 'sms' | 'email';

export type AuthorizationScope = 'confirmations' | string;

/** Audit-trail entry on an authorization (informational). */
export interface AuthorizationAuditEntry {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/** Authorization resource — consent record for sending confirmations. */
export interface Authorization {
  id: string;
  /** HITL configuration the consent belongs to — `confirmations` scope only. */
  hitl_id?: string;
  /** Circle the consent belongs to — `identity_challenge` scope only. */
  circle_id?: string;
  recipient: string;
  status: AuthorizationStatus;
  phone?: string | null;
  channel: AuthorizationChannel;
  scope: AuthorizationScope;
  business_name?: string;
  /** Owner-assigned human label for this approver (F22); null when unset. Surfaces lead with it, falling back to the masked recipient. */
  label?: string | null;
  /** The approver's own messenger name ("First Last @username"), captured when they approved over Telegram; null when none was captured. Chosen by the approver, not verified. */
  recipient_display_name: string | null;
  /** Whether the approver has enrolled an encryption key — a confirmation can be sealed to them only once this is true. */
  enrolled: boolean;
  verification_id?: string;
  proof_token?: string;
  authorized_at?: string;
  expires_at: string;
  revoked_at?: string;
  revocation_reason?: string;
  confirmations_sent: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

/** Body accepted by `PATCH /api/v1/authorizations/:id` — owner-editable metadata (F22). */
export interface UpdateAuthorizationBody {
  /** Owner-assigned human label ("Sarah — CFO"). null or an empty string clears it. */
  label: string | null;
}

/** Body accepted by `POST /api/v1/authorizations`. */
export interface CreateAuthorizationParams {
  hitl_id: string;
  recipient: string;
  phone?: string;
  channel?: AuthorizationChannel;
  scope?: AuthorizationScope;
  /**
   * @deprecated Ignored by the server: the consent message names the approval setup's sub-account.
   */
  business_name?: string;
  business_profile_id?: string;
  /** Seconds from now until the authorization expires. */
  expires_in?: number;
}

/** Response from `POST /api/v1/authorizations`. Includes the authorization URL. */
export interface CreateAuthorizationResponse {
  id: string;
  hitl_id: string;
  recipient: string;
  status: AuthorizationStatus;
  phone?: string | null;
  channel: AuthorizationChannel;
  scope: AuthorizationScope;
  business_name?: string;
  authorization_url: string;
  expires_at: string;
  created_at: string;
}

/** Query params for `GET /api/v1/authorizations`. */
export interface AuthorizationListParams {
  status?: AuthorizationStatus;
  phone?: string;
  channel?: AuthorizationChannel;
  page?: number;
  limit?: number;
}

/** Paginated response from `GET /api/v1/authorizations`. */
export interface AuthorizationListResponse {
  data: Authorization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/** Query params for `GET /api/v1/authorizations/export`. */
export interface AuthorizationExportParams {
  format?: 'json' | 'csv';
  from?: string;
  to?: string;
  status?: AuthorizationStatus;
}

/**
 * Response from `GET /api/v1/authorizations/export?format=json`. CSV
 * exports (`format=csv`) are served as `text/csv` and come back through the
 * http layer's non-JSON envelope instead — `Authorizations.export` has an
 * overload returning `BinaryResponse` for that case.
 */
export interface AuthorizationExportResponse {
  data: Authorization[];
  total: number;
}

// ============================================================================
// Message Templates
// ============================================================================

export type TemplateChannel = 'telegram' | 'whatsapp' | 'sms' | 'email';

export type TemplateMessageType =
  | 'verification_request'
  | 'verification_success'
  | 'verification_expired'
  | 'login_request'
  | 'login_success'
  | '2fa_request'
  | '2fa_success'
  | 'account_deletion_request'
  | 'account_deletion_success'
  | 'confirmation_request'
  | 'confirmation_approved'
  | 'confirmation_denied';

/** Editable template content fields. */
export interface TemplateContent {
  subject?: string;
  body: string;
  button_text?: string;
  button_url_template?: string;
}

/**
 * Which project (sub-account) a templates call acts on. Templates exist per project only.
 *
 * Omitted: a project-bound API key uses its own project, any other caller the primary project. A
 * project-bound key naming a different project is refused (403 `profile_mismatch`).
 */
export interface TemplateProjectOptions {
  /** The project's id, sent as the `profile_id` query parameter. */
  profileId?: string;
}

/** A message template (custom or default). */
export interface Template extends TemplateContent {
  /** Present on custom templates only */
  id?: string;
  /** The project the custom template belongs to. Present on custom templates only */
  profile_id?: string | null;
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  is_active?: boolean;
  version?: number;
  updated_at?: string;
}

/** A variable available for substitution in template bodies. */
export interface TemplateVariable {
  name: string;
  description: string;
}

/** Response from `GET /api/v1/templates`. */
export interface TemplateListResponse {
  /** The project whose templates are listed */
  profile_id: string | null;
  custom_templates: Template[];
  available_channels: TemplateChannel[];
  available_message_types: TemplateMessageType[];
  available_variables: TemplateVariable[];
}

/** Response from `GET /api/v1/templates/defaults`. */
export interface TemplateDefaultsResponse {
  defaults: Record<string, Partial<Record<TemplateChannel, TemplateContent>>>;
}

/** Response from `GET /api/v1/templates/:channel/:messageType`. */
export interface TemplateGetResponse {
  is_custom: boolean;
  /** `project`: the project's own template; `default`: the platform default it falls back to */
  scope: 'project' | 'default';
  /** The project the template was resolved for */
  profile_id: string | null;
  template: Template;
}

/** Response from `PUT /api/v1/templates/:channel/:messageType`. */
export interface TemplateUpsertResponse {
  success: boolean;
  template: Template;
}

/** Response from `DELETE /api/v1/templates/:channel/:messageType`. */
export interface TemplateDeleteResponse {
  success: boolean;
  message: string;
}

/** A template rendered with variables substituted. */
export interface RenderedTemplate {
  subject?: string;
  body: string;
  button_text?: string;
  button_url?: string;
}

/** Body accepted by `POST /api/v1/templates/preview`. */
export interface TemplatePreviewParams extends TemplateContent {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
}

/** Response from `POST /api/v1/templates/preview`. */
export interface TemplatePreviewResponse {
  preview: RenderedTemplate;
  validation_errors: string[];
  is_valid: boolean;
}

/** Body accepted by `POST /api/v1/templates/render`. */
export interface TemplateRenderParams {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  variables?: {
    code?: string;
    expires_in?: string;
    user_identifier?: string;
    callback_url?: string;
  };
}

/** Response from `POST /api/v1/templates/render`. */
export interface TemplateRenderResponse {
  rendered: RenderedTemplate;
}

// ============================================================================
// Profiles (multi-brand public profiles under /api/v1/me/profiles)
// ============================================================================

export interface ProfileTheme {
  primary_color?: string;
  background_type?: 'solid' | 'gradient';
  background_color?: string;
  gradient_start?: string;
  gradient_end?: string;
  font_style?: 'default' | 'modern' | 'classic';
}

export interface CustomLink {
  title: string;
  url: string;
  icon?: string;
  is_visible?: boolean;
  display_order?: number;
}

/** A public profile owned by the authenticated user. */
export interface Profile {
  id: string;
  profile_id: string;
  username?: string;
  is_primary?: boolean;
  display_name?: string;
  bio?: string;
  avatar_url?: string | null;
  verification_level?: string;
  is_business?: boolean;
  business_name?: string;
  public_proofs?: unknown[];
  custom_links?: CustomLink[];
  theme?: ProfileTheme;
  is_public: boolean;
  show_verification_dates?: boolean;
  show_proof_channels?: boolean;
  /** The owner's switch for the public Delegations section (default true). */
  show_delegations?: boolean;
  /** Theme of this project's emails; null when unset (read as `dark`). Returned to the owner. */
  email_theme?: 'dark' | 'light' | null;
  /** Support address shown in this project's messages as `{{support_email}}`. Returned to the owner. */
  support_email?: string | null;
  view_count?: number;
  created_at: string;
  updated_at: string;
}

/** Body accepted by `POST /api/v1/me/profiles`. */
export interface CreateProfileParams {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  business_name?: string;
  is_business?: boolean;
  is_public?: boolean;
  is_primary?: boolean;
  theme?: ProfileTheme;
  /** Theme of the HTML emails sent for this project. Unset reads as `dark`. */
  email_theme?: 'dark' | 'light';
  /** Support address shown in this project's messages as `{{support_email}}`. */
  support_email?: string;
}

/** Body accepted by `PATCH /api/v1/me/profiles/:profileId`. */
export interface UpdateProfileParams {
  display_name?: string;
  bio?: string;
  avatar_url?: string | null;
  business_name?: string;
  is_business?: boolean;
  is_public?: boolean;
  is_primary?: boolean;
  show_verification_dates?: boolean;
  show_proof_channels?: boolean;
  /** Whether the public profile lists the published, in-force delegations for the domains it shows. */
  show_delegations?: boolean;
  theme?: ProfileTheme;
  custom_links?: CustomLink[];
  /** Theme of the HTML emails sent for this project. Unset reads as `dark`. */
  email_theme?: 'dark' | 'light';
  /** Support address shown in this project's messages as `{{support_email}}`; `null` clears it. */
  support_email?: string | null;
}

/** Response from `GET /api/v1/me/profiles`. */
export interface ProfileListResponse {
  profiles: Profile[];
  count: number;
  /** -1 = unlimited under the current plan */
  max_profiles: number;
}

/** Response from `DELETE /api/v1/me/profiles/:profileId`. */
export interface ProfileDeleteResponse {
  success: boolean;
  message: string;
}

/** A per-profile message template (custom or default). */
export interface ProfileTemplate {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  subject?: string;
  body: string;
  button_text?: string;
  button_url_template?: string;
  is_custom: boolean;
  is_active: boolean;
}

/** Response from `GET /api/v1/me/profiles/:profileId/templates`. */
export interface ProfileTemplateListResponse {
  profile_id: string;
  templates: ProfileTemplate[];
}

/** Body accepted by `PUT /api/v1/me/profiles/:profileId/templates/:channel/:type`. */
export interface ProfileTemplateUpdateParams {
  subject?: string;
  body: string;
  button_text?: string;
  button_url_template?: string;
  is_active?: boolean;
}

/** Body accepted by `POST /api/v1/me/profiles/:profileId/templates/preview`. */
export interface ProfileTemplatePreviewParams extends TemplateContent {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
}

/** Response from `POST /api/v1/me/profiles/:profileId/templates/preview`. */
export interface ProfileTemplatePreviewResponse {
  preview: RenderedTemplate;
  variables_used: string[];
}

// ============================================================================
// Public Profiles (unauthenticated reads under /api/v1/profiles)
// ============================================================================

/** A proof entry on a public profile (channel is never exposed publicly). */
export interface PublicProfileProof {
  type: string;
  display_value?: string;
  label?: string;
  verified_at?: string;
}

/** A visible custom link on a public profile. */
export interface PublicProfileLink {
  title: string;
  url: string;
  icon?: string;
}

/** Public view of a profile from `GET /api/v1/profiles/p/:profileId` or `/u/:username`. */
export interface PublicProfileView {
  profile_id: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  verification_level?: string;
  is_business?: boolean;
  business_name?: string;
  proofs: PublicProfileProof[];
  links: PublicProfileLink[];
  theme?: ProfileTheme;
  /**
   * The published, in-force delegations for the domains this profile shows in full. Empty when the
   * owner turned the section off; null when they could not be read — never an empty list standing
   * in for an unknown.
   */
  delegations?: PublicProfileDelegation[] | null;
}

/** One entry of a public profile's Delegations section. */
export interface PublicProfileDelegation {
  /** The canonical artifact identity, e.g. `pkg:npm/@proof-holdings/mcp-server`. */
  delegate: string;
  delegate_type: 'url' | 'purl';
  /** The domain, shown on this profile, that authorized the artifact. */
  principal: string;
  scope: string[];
  issued_at: string;
  expires_at: string;
  /** The artifact's page on proof.holdings; null for a class with no page. */
  artifact_path: string | null;
}

/**
 * Response from `GET /api/v1/profiles/badge/:username` — everything needed to embed the
 * verification badge.
 *
 * `state` is the field to branch on, not the HTTP status: an unknown username, a profile that is
 * not public, and a published profile with no live proof ALL answer 200 with
 * `no_public_record` and are deliberately indistinguishable from one another.
 *
 * `badge_urls` are extensionless by design — the badge is served live, and a `.svg` URL would be
 * cached as an immutable static image.
 */
export interface ProfileBadge {
  username: string;
  /** What the badge asserts about: a verified domain, else a name, else the handle. */
  subject: string;
  verified_count: number;
  state: 'published' | 'no_public_record';
  checked_at: string;
  profile_url: string;
  badge_urls: { default: string; paper: string; compact: string };
  snippets: { markdown: string; html: string };
}

/** Response from `GET /api/v1/profiles/check-username/:username`. */
export interface UsernameAvailabilityResponse {
  available: boolean;
  reason?: string;
}

/**
 * Binary response envelope produced by the http layer for non-JSON 2xx
 * responses (e.g. avatar images, CSV exports).
 */
export interface BinaryResponse {
  data: Uint8Array;
  content_type: string;
}

/** Envelope returned by `GET /api/v1/profiles/p/:profileId/avatar`. */
export type AvatarResponse = BinaryResponse;