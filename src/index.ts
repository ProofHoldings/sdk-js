export { Proof } from './client.js';
export { VERSION } from './version.js';
export { ProfileTemplates, ScopedProfile } from './resources/profiles.js';

/** @deprecated Use `Proof` instead. Will be removed in v2.0. */
export { Proof as ProofHoldings } from './client.js';

// Error classes
export {
  ProofError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServerError,
  NetworkError,
  TimeoutError,
  PollingTimeoutError,
} from './errors.js';

/** @deprecated Use `ProofError` instead. Will be removed in v2.0. */
export { ProofError as ProofHoldingsError } from './errors.js';

// Types
export type {
  // Core types
  VerificationType,
  VerificationChannel,
  VerificationStatus,
  SessionChannel,
  VerificationRequestStatus,
  ActionType,

  // API types
  ApiError,
  Pagination,
  PaginatedList,

  // Verification
  ChallengeInstructions,
  ProofToken,
  Verification,
  CreateVerificationParams,
  ListVerificationsParams,
  ResendResponse,
  TestVerifyResponse,
  StartDomainVerificationParams,
  DomainVerification,
  DomainCheckResponse,
  VerifiedUserVerification,
  VerifiedUser,
  ListVerifiedUsersParams,

  // Verification Requests
  RequestedAsset,
  VerificationRequestAsset,
  VerificationRequest,
  CreateVerificationRequestParams,
  ListVerificationRequestsParams,

  // Proofs
  ProofStatus,
  ProofValidation,
  RevokedProof,
  RevocationList,
  RevokeResponse,
  OfflineVerificationResult,

  // Sessions
  Session,
  CreateSessionParams,

  // Webhook Deliveries
  WebhookPayload,
  WebhookDelivery,
  WebhookRetryResponse,
  WebhookDeliveryList,
  WebhookDeliveryStats,
  WebhookPagination,
  ListWebhookDeliveriesParams,

  // Templates
  TemplateChannel,
  TemplateMessageType,
  Template,
  TemplateVariable,
  TemplateListResponse,
  TemplateDefaultsResponse,
  TemplateRetrieveResponse,
  UpsertTemplateParams,
  UpsertTemplateResponse,
  DeleteTemplateResponse,
  PreviewTemplateParams,
  PreviewTemplateResponse,
  RenderTemplateParams,
  RenderTemplateResponse,

  // Profile Templates
  ProfileTemplate,
  ProfileTemplateListResponse,
  UpdateProfileTemplateParams,
  ProfileTemplateResponse,
  PreviewProfileTemplateParams,
  PreviewProfileTemplateResponse,

  // Billing
  BillingPlan,
  SubscriptionInfo,
  CheckoutParams,
  CheckoutResponse,
  PortalParams,
  PortalResponse,

  // Shared
  SuccessResponse,

  // Phones
  PhoneChannel,
  Phone,
  PhoneListResponse,
  StartAddPhoneParams,
  AddPhoneSession,
  AddPhoneStatus,

  // Emails
  Email,
  EmailListResponse,
  StartAddEmailParams,
  AddEmailSession,
  AddEmailStatus,
  VerifyEmailOtpParams,
  EmailVerifiedResponse,
  EmailResendResponse,

  // Assets
  AssetType,
  AssetStatus,
  Asset,
  AssetListResponse,
  ListAssetsParams,

  // Auth
  CurrentUser,
  AuthSession,
  AuthSessionListResponse,

  // Settings
  EmailTheme,
  BrandingSettings,
  UserSettings,
  UpdateSettingsParams,
  ListUsageParams,
  UsageResponse,
  ExportResponse,

  // API Keys
  ApiKeyEnvironment,
  ApiKeyScope,
  ApiKey,
  ApiKeyListResponse,
  CreateApiKeyParams,
  CreateApiKeyResponse,

  // Profiles
  ProfileTheme,
  ProfileCustomLink,
  Profile,
  ProfileListResponse,
  CreateProfileParams,
  UpdateProfileParams,
  DeleteProfileResponse,
  SetPrimaryProfileResponse,

  // Account
  AccountDeletionSession,
  AccountDeletionStatus,
  VerifyAccountDeletionParams,
  DeleteAccountParams,

  // 2FA
  TwoFAActionType,
  StartTwoFAParams,
  TwoFASession,
  TwoFAStatus,
  VerifyTwoFAParams,

  // DNS Credentials
  DnsCredential,
  DnsCredentialListResponse,
  CreateDnsCredentialParams,

  // Domains
  VerificationMethod,
  EmailPrefix,
  Domain,
  DomainListResponse,
  AddDomainParams,
  OAuthUrlResponse,
  ConnectCloudflareParams,
  ConnectGoDaddyParams,
  ConnectProviderParams,
  DnsProviderMetadata,
  StartEmailVerificationParams,
  VerifyEmailCodeParams,
  SetupEmailSendingParams,

  // User Domain Verify
  StartUserDomainVerifyParams,

  // Authorizations
  AuthorizationChannel,
  AuthorizationScope,
  AuthorizationStatus,
  Authorization,
  CreateAuthorizationParams,
  CreateAuthorizationResponse,
  AuthorizationListParams,
  AuthorizationListResponse,
  AuthorizationExportParams,
  AuthorizationExportResponse,

  // HITL
  Hitl,
  HitlStatus,
  HitlChannelType,
  HitlChannel,
  CreateHitlParams,
  UpdateHitlParams,
  HitlListParams,
  HitlListResponse,

  // HITL Keys
  HitlKeysResponse,
  HitlKeysPutParams,
  HitlKeysPutResponse,
  HitlKeysDeleteResponse,

  // Confirmations
  Confirmation,
  ConfirmationStatus,
  CreateConfirmationParams,
  ConfirmationListParams,
  ConfirmationListResponse,

  // Config
  ProofOptions,
  WaitOptions,
} from './types.js';

/** @deprecated Use `ProofOptions` instead. Will be removed in v2.0. */
export type { ProofOptions as ProofHoldingsOptions } from './types.js';

// HITL Encryption crypto module
export {
  encryptMessage,
  decryptMessage,
  encryptPrivateKey,
  decryptPrivateKey,
  generateKeyPair,
  generateEncryptionKeyPair,
  computeKid,
  deriveKey,
  validateMessageEnvelope,
  validatePrivateKeyEnvelope,
} from './crypto/hitl-crypto.js';

export type {
  CiphertextEnvelope,
  EncryptedPrivateKey,
  HitlKeyPair,
} from './crypto/hitl-crypto.js';

// Default export for convenience: import Proof from '@proof-holdings/sdk'
export { Proof as default } from './client.js';
