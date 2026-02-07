// ============================================================================
// Core Types
// ============================================================================

export type VerificationType = 'phone' | 'email' | 'domain' | 'social' | 'wallet' | 'account';

export type VerificationChannel =
  'whatsapp' | 'telegram' | 'viber' | 'sms'
  | 'email'
  | 'dns' | 'http' | 'auto'
  | 'github' | 'google' | 'facebook' | 'x' | 'linkedin' | 'instagram' | 'youtube' | 'tiktok'
  | 'ethereum' | 'solana' | 'bitcoin'
  | 'coinbase' | 'kraken';

export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired' | 'revoked';

export type SessionChannel = 'telegram' | 'whatsapp' | 'viber' | 'sms';

export type VerificationRequestStatus = 'pending' | 'partial' | 'completed' | 'expired' | 'cancelled';

export type ActionType = 'verification' | '2fa' | 'login' | 'custom';

// ============================================================================
// API Response Envelope
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
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
  code: string;
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
}

export interface Verification {
  id: string;
  type: VerificationType;
  channel: VerificationChannel;
  status: VerificationStatus;
  identifier: string;
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
}

export interface ListVerificationsParams {
  status?: VerificationStatus;
  type?: VerificationType;
  channel?: VerificationChannel;
  limit?: number;
  page?: number;
}

// ============================================================================
// Verification Requests (Multi-Asset)
// ============================================================================

export interface RequestedAsset {
  type: VerificationType;
  identifier?: string;
  channel?: VerificationChannel;
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

export interface VerificationRequest {
  id: string;
  reference_id?: string;
  status: VerificationRequestStatus;
  action_type: ActionType;
  action_context?: Record<string, unknown>;
  assets: VerificationRequestAsset[];
  partial_ok?: boolean;
  validity_requirement?: string;
  verification_url: string;
  redirect_url?: string;
  callback_url?: string;
  expires_at: string;
  completed_at?: string;
  created_at: string;
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
  /** Expiry in seconds (default: 86400 = 24 hours) */
  expires_in?: number;
  public_profile_id?: string;
}

export interface ListVerificationRequestsParams {
  status?: VerificationRequestStatus;
  reference_id?: string;
  limit?: number;
  page?: number;
}

// ============================================================================
// Proofs
// ============================================================================

export interface ProofValidation {
  valid: boolean;
  reason?: string;
  message?: string;
  verification?: {
    id: string;
    type: VerificationType;
    channel: VerificationChannel;
    verified_at: string;
    expires_at: string;
    user_id: string;
    identifier?: string;
  };
  revoked_at?: string;
  revoked_reason?: string;
}

export interface RevokedProof {
  proof_id: string;
  revoked_at: string | null;
  reason?: string;
}

export interface RevocationList {
  revoked: RevokedProof[];
  issued_at: string;
  count: number;
  signature: string | null;
  kid: string | null;
}

export interface RevokeResponse {
  success: boolean;
  verification_id: string;
  revoked_at: string;
  reason: string;
}

// ============================================================================
// Sessions (Phone-First Flow)
// ============================================================================

export interface Session {
  id: string;
  channel: SessionChannel;
  status: VerificationStatus;
  deep_link?: string;
  qr_code?: string;
  instructions?: string;
  phone_number?: string;
  verified_at?: string;
  verification_id?: string;
  proof?: ProofToken;
  expires_at: string;
  created_at?: string;
}

export interface CreateSessionParams {
  channel: SessionChannel;
  client_metadata?: Record<string, unknown>;
  context?: {
    business_name?: string;
    action?: 'login' | '2fa' | 'verification' | 'recovery';
  };
}

// ============================================================================
// Webhook Deliveries
// ============================================================================

export interface WebhookDelivery {
  id: string;
  url: string;
  event_type: string;
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
  deliveries: WebhookDelivery[];
  pagination: WebhookPagination;
}

export interface WebhookPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
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
  };
  error?: string;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface ProofOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
}

// ============================================================================
// Polling
// ============================================================================

export interface WaitOptions {
  /** Poll interval in milliseconds (default: 3000) */
  interval?: number;
  /** Timeout in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}
