// ============================================================================
// Core Types
// ============================================================================

export type VerificationType = 'phone' | 'email' | 'domain' | 'social' | 'wallet' | 'account' | 'waba' | 'telegram_bot';

export type VerificationChannel =
  'whatsapp' | 'telegram' | 'viber' | 'sms'
  | 'email'
  | 'dns' | 'http' | 'auto'
  | 'github' | 'google' | 'facebook' | 'x' | 'linkedin' | 'instagram' | 'youtube' | 'tiktok'
  | 'ethereum' | 'solana' | 'bitcoin'
  | 'coinbase' | 'kraken'
  | 'waba_otp'
  | 'telegram_bot_token';

export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'expired' | 'revoked';

export type SessionChannel = 'whatsapp' | 'telegram' | 'viber' | 'sms';

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
  /** Seconds to wait before retrying (rate limit and lockout errors) */
  retryAfter?: number;
  /** Number of remaining attempts before lockout (auth endpoints only) */
  remaining_attempts?: number;
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
  status: string;
  is_valid: boolean;
  is_revoked: boolean;
  revoked_at?: string;
  revoked_reason?: string;
  expires_at?: string;
  is_expired: boolean;
  verified_at?: string;
}

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
// Templates
// ============================================================================

export type TemplateChannel = 'telegram' | 'whatsapp' | 'sms' | 'email';

export type TemplateMessageType =
  'verification_request' | 'verification_success' | 'verification_expired'
  | 'login_request' | 'login_success'
  | '2fa_request' | '2fa_success';

export interface Template {
  id?: string;
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  subject?: string;
  body: string;
  button_text?: string;
  button_url_template?: string;
  is_active?: boolean;
  version?: number;
  updated_at?: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
}

export interface TemplateListResponse {
  custom_templates: Template[];
  available_channels: TemplateChannel[];
  available_message_types: TemplateMessageType[];
  available_variables: TemplateVariable[];
}

export interface TemplateDefaultsResponse {
  defaults: Record<string, Record<string, unknown>>;
}

export interface TemplateRetrieveResponse {
  is_custom: boolean;
  template: Template;
}

export interface UpsertTemplateParams {
  body: string;
  subject?: string;
  button_text?: string;
  button_url_template?: string;
}

export interface UpsertTemplateResponse {
  success: boolean;
  template: Template;
}

export interface DeleteTemplateResponse {
  success: boolean;
  message: string;
}

export interface PreviewTemplateParams {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  body: string;
  subject?: string;
  button_text?: string;
  button_url_template?: string;
}

export interface PreviewTemplateResponse {
  preview: Record<string, unknown>;
  validation_errors: string[];
  is_valid: boolean;
}

export interface RenderTemplateParams {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  variables?: {
    code?: string;
    expires_in?: string;
    user_identifier?: string;
    callback_url?: string;
  };
}

export interface RenderTemplateResponse {
  rendered: Record<string, unknown>;
}

// ============================================================================
// Projects
// ============================================================================

export interface ProjectBranding {
  business_name?: string;
  logo_url?: string;
  primary_color?: string;
  support_email?: string;
}

export interface ProjectCallbacks {
  success_url?: string;
  failure_url?: string;
  cancel_url?: string;
}

export interface ProjectTemplate {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  subject?: string;
  body: string;
  button_text?: string;
  button_url_template?: string;
  is_custom: boolean;
  is_active: boolean;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  is_default?: boolean;
  branding: ProjectBranding;
  callbacks?: ProjectCallbacks;
  status: 'active' | 'archived';
  template_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  data: Project[];
}

export interface CreateProjectParams {
  name: string;
  description?: string;
  branding?: ProjectBranding;
}

export interface UpdateProjectParams {
  name?: string;
  description?: string;
  branding?: ProjectBranding;
  callbacks?: ProjectCallbacks;
}

export interface DeleteProjectResponse {
  success: boolean;
}

export interface ProjectTemplateListResponse {
  project_id: string;
  branding: ProjectBranding;
  templates: ProjectTemplate[];
}

export interface UpdateProjectTemplateParams {
  body: string;
  subject?: string;
  button_text?: string;
  button_url_template?: string;
  is_active?: boolean;
}

export interface ProjectTemplateResponse {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  subject?: string;
  body: string;
  button_text?: string;
  button_url_template?: string;
  is_custom: boolean;
  is_active: boolean;
}

export interface PreviewProjectTemplateParams {
  channel: TemplateChannel;
  message_type: TemplateMessageType;
  body: string;
  subject?: string;
  button_text?: string;
  button_url_template?: string;
}

export interface PreviewProjectTemplateResponse {
  preview: Record<string, unknown>;
  variables_used: string[];
}

// ============================================================================
// Billing
// ============================================================================

export type BillingPlan = 'pro' | 'business' | 'white_label' | 'enterprise';

export interface SubscriptionInfo {
  plan: string;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface CheckoutParams {
  plan: BillingPlan;
  success_url: string;
  cancel_url: string;
}

export interface CheckoutResponse {
  checkout_url: string;
}

export interface PortalParams {
  return_url: string;
}

export interface PortalResponse {
  portal_url: string;
}

// ============================================================================
// Shared
// ============================================================================

export interface SuccessResponse {
  success: boolean;
}

// ============================================================================
// Phones
// ============================================================================

export type PhoneChannel = 'telegram' | 'whatsapp' | 'sms';

export interface Phone {
  id: string;
  phone_number: string;
  verification_channel: PhoneChannel;
  verified_channels: PhoneChannel[];
  is_primary: boolean;
  verified_at: string;
  created_at: string;
}

export interface PhoneListResponse {
  data: Phone[];
}

export interface StartAddPhoneParams {
  channel: PhoneChannel;
}

export interface AddPhoneSession {
  session_id: string;
  channel: PhoneChannel;
  status: string;
  expires_at: string;
  deep_link?: string;
  qr_code?: string;
  instructions?: string;
  sms_code?: string;
  sms_message?: string;
  sms_dids?: Record<string, { did: string; label: string; flag: string; qr_code?: string }>;
}

export interface AddPhoneStatus {
  session_id: string;
  phone_number?: string;
  channel: PhoneChannel;
  status: 'pending' | 'verified';
  verified_at?: string;
}

// ============================================================================
// Emails
// ============================================================================

export interface Email {
  id: string;
  email: string;
  verification_channel: 'otp' | 'magic_link';
  verified_methods: ('otp' | 'magic_link')[];
  is_primary: boolean;
  verified_at: string;
  created_at: string;
}

export interface EmailListResponse {
  data: Email[];
}

export interface StartAddEmailParams {
  email: string;
}

export interface AddEmailSession {
  session_id: string;
  email: string;
  channel: string;
  status: string;
  expires_at: string;
  instructions?: string;
  email_sent: boolean;
  email_error?: string;
}

export interface AddEmailStatus {
  session_id: string;
  email: string;
  channel: string;
  status: 'pending' | 'verified';
  verified_at?: string;
}

export interface VerifyEmailOtpParams {
  code: string;
}

export interface EmailVerifiedResponse {
  status: string;
  email: string;
  verified_at: string;
}

export interface EmailResendResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Assets
// ============================================================================

export type AssetType = 'phone' | 'email' | 'domain' | 'social' | 'wallet';
export type AssetStatus = 'active' | 'expired' | 'revoked';

export interface Asset {
  id: string;
  type: AssetType;
  channel: VerificationChannel;
  identifier: string;
  verified_at: string;
  status: AssetStatus;
  has_proof?: boolean;
  proof_expires_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AssetListResponse {
  data: Asset[];
}

export interface ListAssetsParams {
  type?: AssetType;
  status?: AssetStatus;
}

// ============================================================================
// Auth
// ============================================================================

export interface CurrentUser {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  id: string;
  channel: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface AuthSessionListResponse {
  sessions: AuthSession[];
  total: number;
}

// ============================================================================
// Settings
// ============================================================================

export type EmailTheme = 'dark' | 'light';

export interface BrandingSettings {
  business_name?: string;
  logo_url?: string | null;
  primary_color?: string;
  support_email?: string;
  email_theme?: EmailTheme;
}

export interface UserSettings {
  branding?: BrandingSettings;
}

export interface UpdateSettingsParams {
  branding?: BrandingSettings;
}

export interface ListUsageParams {
  period?: string;
  months?: number;
}

export interface UsageResponse {
  [key: string]: unknown;
}

export interface ExportResponse {
  [key: string]: unknown;
}

// ============================================================================
// API Keys
// ============================================================================

export type ApiKeyEnvironment = 'production' | 'test';

export type ApiKeyScope =
  | 'verifications:read' | 'verifications:write' | 'verifications:create' | 'verifications:*'
  | 'proofs:read' | 'proofs:*'
  | 'templates:read' | 'templates:write' | 'templates:*'
  | 'profiles:read' | 'profiles:write' | 'profiles:*'
  | 'projects:read' | 'projects:write' | 'projects:*'
  | 'billing:read' | 'billing:write' | 'billing:*';

export interface ApiKey {
  id: string;
  name?: string;
  prefix: string;
  environment: ApiKeyEnvironment;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at?: string;
}

export interface ApiKeyListResponse {
  api_keys: ApiKey[];
}

export interface CreateApiKeyParams {
  name?: string;
  environment?: ApiKeyEnvironment;
  scopes?: ApiKeyScope[];
}

export interface CreateApiKeyResponse {
  api_key: ApiKey;
  key: string;
}

// ============================================================================
// Account Deletion
// ============================================================================

export interface AccountDeletionSession {
  session_id: string;
  status: string;
  expires_at: string;
  email_sent?: boolean;
  magic_link_sent?: boolean;
}

export interface AccountDeletionStatus {
  session_id: string;
  status: string;
  verified?: boolean;
  expires_at: string;
}

export interface VerifyAccountDeletionParams {
  code: string;
}

export interface DeleteAccountParams {
  session_id: string;
}

// ============================================================================
// 2FA
// ============================================================================

export type TwoFAActionType =
  | 'api_key_view'
  | 'api_key_create'
  | 'api_key_revoke'
  | 'api_key_regenerate'
  | 'phone_add'
  | 'phone_remove'
  | 'email_add'
  | 'email_remove'
  | 'account_delete';

export interface StartTwoFAParams {
  action_type: TwoFAActionType;
  channel: 'telegram' | 'whatsapp' | 'sms' | 'email';
  email_id?: string;
}

export interface TwoFASession {
  session_id: string;
  status: string;
  expires_at: string;
  email_sent?: boolean;
  magic_link_sent?: boolean;
}

export interface TwoFAStatus {
  session_id: string;
  status: string;
  verified?: boolean;
  expires_at: string;
}

export interface VerifyTwoFAParams {
  code: string;
}

// ============================================================================
// DNS Credentials
// ============================================================================

export interface DnsCredential {
  id: string;
  provider: string;
  label?: string;
  created_at: string;
}

export interface DnsCredentialListResponse {
  data: DnsCredential[];
}

export interface CreateDnsCredentialParams {
  provider: string;
  credentials: Record<string, string>;
  label?: string;
}

// ============================================================================
// Domains
// ============================================================================

export type VerificationMethod = 'auto_dns' | 'manual_dns' | 'http_file' | 'email';

export type EmailPrefix = 'admin' | 'administrator' | 'webmaster' | 'hostmaster' | 'postmaster';

export interface Domain {
  id: string;
  domain: string;
  status: string;
  verification_method?: VerificationMethod;
  provider?: string;
  project_id?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DomainListResponse {
  data: Domain[];
}

export interface AddDomainParams {
  domain: string;
  project_id?: string;
  for_email_sending?: boolean;
  verification_method?: VerificationMethod;
}

export interface OAuthUrlResponse {
  oauth_url: string;
  state: string;
}

export interface ConnectCloudflareParams {
  api_token: string;
}

export interface ConnectGoDaddyParams {
  api_key: string;
  api_secret: string;
}

export interface ConnectProviderParams {
  credentials: Record<string, string>;
}

export interface DnsProviderMetadata {
  [key: string]: unknown;
}

export interface StartEmailVerificationParams {
  email_prefix?: EmailPrefix;
}

export interface VerifyEmailCodeParams {
  code: string;
}

export interface SetupEmailSendingParams {
  from_email?: string;
}

// ============================================================================
// User Domain Verify
// ============================================================================

export interface StartUserDomainVerifyParams {
  domain: string;
  channel?: 'dns' | 'http';
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

// ============================================================================
// Profiles
// ============================================================================

export interface ProfileTheme {
  primary_color?: string;
  background_type?: 'solid' | 'gradient';
  background_color?: string;
  gradient_start?: string;
  gradient_end?: string;
  font_style?: 'default' | 'modern' | 'classic';
}

export interface ProfileCustomLink {
  title: string;
  url: string;
  icon?: string;
  is_visible?: boolean;
  display_order?: number;
}

export interface Profile {
  /** MongoDB document ID — use this with retrieve(), update(), delete(), setPrimary() */
  id: string;
  /** Short URL-slug for public profile pages (/p/{profile_id}) — not interchangeable with id */
  profile_id: string;
  username?: string;
  is_primary: boolean;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  verification_level: string;
  is_business: boolean;
  business_name?: string;
  public_proofs?: unknown[];
  custom_links?: ProfileCustomLink[];
  theme?: ProfileTheme;
  is_public: boolean;
  show_verification_dates?: boolean;
  show_proof_channels?: boolean;
  view_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileListResponse {
  profiles: Profile[];
}

export interface CreateProfileParams {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  business_name?: string;
  is_business?: boolean;
  is_public?: boolean;
  is_primary?: boolean;
  theme?: ProfileTheme;
}

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
  theme?: ProfileTheme;
  custom_links?: ProfileCustomLink[];
}

export interface DeleteProfileResponse {
  success: boolean;
  message?: string;
}

export interface SetPrimaryProfileResponse {
  success: boolean;
  profile: Profile;
}
