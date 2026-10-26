export { Proof } from './client.js';
export { VERSION } from './version.js';

// Key and base-URL resolution (what `new Proof()` with no key runs)
export {
  resolveApiKey,
  resolveBaseUrl,
  credentialKey,
  defaultCredentialsPath,
  LOGIN_COMMAND,
} from './credentials.js';
export type { ResolvedKey, KeySource } from './credentials.js';

// Streaming helpers
export {
  streamEndpoint,
  type SSEEvent,
  type StreamEvent,
  type StreamOptions,
  type StreamConfig,
} from './streaming.js';

// Resource classes and types for streaming endpoints
export {
  AuthSessions,
  type AuthSession,
  type AuthSessionStreamConnected,
  type AuthSessionStreamUpdate,
  type AuthSessionStreamEvent,
} from './resources/auth-sessions.js';
export {
  Me,
  type PhoneAddSession,
  type PhoneAddSessionStreamConnected,
  type PhoneAddSessionStreamUpdate,
  type PhoneAddSessionStreamEvent,
  type EmailAddSession,
  type EmailAddSessionStreamConnected,
  type EmailAddSessionStreamUpdate,
  type EmailAddSessionStreamEvent,
  type TwoFASession,
  type TwoFASessionStreamConnected,
  type TwoFASessionStreamUpdate,
  type TwoFASessionStreamEvent,
} from './resources/me.js';
export {
  HitlChatIdDiscovery,
  type ChatIdDiscovery,
  type ChatIdDiscoveryStreamConnected,
  type ChatIdDiscoveryStreamUpdate,
  type ChatIdDiscoveryStreamEvent,
} from './resources/hitl-chat-id.js';
export type {
  ConfirmationStreamConnected,
  ConfirmationStreamUpdate,
  ConfirmationStreamEvent,
} from './resources/confirmations.js';
export type {
  VerificationStreamConnected,
  VerificationStreamUpdate,
  VerificationStreamEvent,
} from './resources/verifications.js';

// Authorization consent resource
export { Authorizations } from './resources/authorizations.js';
export type {
  VerificationRequestAssetStatus,
  VerificationRequestAssetStreamConnected,
  VerificationRequestAssetStreamUpdate,
  VerificationRequestAssetStreamEvent,
} from './resources/verification-requests.js';

// HITL config resource
export { Hitl } from './resources/hitl.js';

// Message templates resource
export { Templates } from './resources/templates.js';

// Profiles resource
export { Profiles } from './resources/profiles.js';

// Public profiles resource
export { PublicProfiles } from './resources/public-profiles.js';

// Proof-Me resource (anti-impersonation challengers + identity challenges + drills)
export { ProofMe } from './resources/proof-me.js';
export type {
  ProofMeChannel,
  CreateIdentityChallengeParams,
  IdentityChallenge,
  IdentityChallengeStatus,
} from './resources/proof-me.js';

// Circles resource (people-primitive: members + member channels)
export { Circles } from './resources/circles.js';

// Delegations resource (Proof of Delegation: domain → typed artifact)
export { Delegations } from './resources/delegations.js';

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
  ConfirmationDeniedError,
} from './errors.js';

// Types
export type {
  // Core types
  VerificationType,
  VerificationChannel,
  VerificationStatus,
  SessionChannel,
  SessionSmsNumber,
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
  MultiChannelPhoneChannel,
  CreateMultiChannelVerificationParams,
  MultiChannelChannelBlock,
  MultiChannelVerificationResponse,
  MultiChannelGroupStatusResponse,

  // Verification Requests
  RequestedAsset,
  VerificationRequestAsset,
  VerificationRequest,
  VerificationRequestListItem,
  CancelVerificationRequestResponse,
  CreateVerificationRequestParams,
  ListVerificationRequestsParams,

  // Proofs
  ProofStatus,
  ProofValidation,
  RevokedProof,
  RevocationList,
  RevokeResponse,
  OfflineVerificationResult,
  OfflineVerificationOptions,
  OfflineFailureReason,
  OfflinePullHint,

  // Sessions
  Session,
  CreateSessionParams,

  // Webhook Deliveries
  WebhookDelivery,
  WebhookRetryResponse,
  WebhookDeliveryList,
  WebhookDeliveryStats,
  WebhookPagination,
  ListWebhookDeliveriesParams,

  // HITL Configs
  HitlStatus,
  HitlChannel,
  HitlConfig,
  CreateHitlParams,
  UpdateHitlParams,
  HitlListParams,
  HitlListResponse,
  HitlAuthorizationResult,
  HitlAuthorizationResponse,
  HitlFinalizeResponse,
  ChatIdDiscoveryCreateResponse,
  ApprovalLinkResponse,
  VerificationRequestProof,
  VerificationRequestProofsResponse,

  // Circles
  CircleStatus,
  CircleMemberStatus,
  CircleMemberChannelType,
  CircleMemberChannelStatus,
  CircleMember,
  Circle,
  CircleListResponse,
  CircleMemberInput,
  CreateCircleParams,
  UpdateCircleParams,
  CircleListParams,
  CircleMemberListResponse,
  CreateCircleMemberParams,
  CircleMemberInviteResponse,
  CircleMemberDrillResponse,
  AddCircleMemberChannelParams,
  CircleMemberChannel,
  CircleMemberChannelListResponse,

  // Delegations
  DelegateIdentifierType,
  DelegationStatus,
  DelegationEffectiveStatus,
  RevokeDelegationReason,
  DelegateIdentifier,
  Delegation,
  DelegationWithToken,
  DelegationDetail,
  CreateDelegationParams,
  DelegationListParams,
  DelegationListResponse,
  RevokeDelegationParams,

  // HITL Encryption Keys
  HitlKeysResponse,
  HitlKeysPutParams,
  HitlKeysPutResponse,
  HitlKeysDeleteResponse,
  HitlApproverKey,
  HitlApproverKeysResponse,

  // Authorizations
  Authorization,
  UpdateAuthorizationBody,
  CreateAuthorizationParams,
  AuthorizationListParams,
  AuthorizationListResponse,
  CreateAuthorizationResponse,
  AuthorizationExportParams,
  AuthorizationExportResponse,

  // Message Templates
  TemplateChannel,
  TemplateMessageType,
  TemplateContent,
  TemplateProjectOptions,
  Template,
  TemplateVariable,
  TemplateListResponse,
  TemplateDefaultsResponse,
  TemplateGetResponse,
  TemplateUpsertResponse,
  TemplateDeleteResponse,
  RenderedTemplate,
  TemplatePreviewParams,
  TemplatePreviewResponse,
  TemplateRenderParams,
  TemplateRenderResponse,

  // Profiles
  ProfileTheme,
  CustomLink,
  Profile,
  CreateProfileParams,
  UpdateProfileParams,
  ProfileListResponse,
  ProfileDeleteResponse,
  ProfileTemplate,
  ProfileTemplateListResponse,
  ProfileTemplateUpdateParams,
  ProfileTemplatePreviewParams,
  ProfileTemplatePreviewResponse,

  // Public Profiles
  PublicProfileProof,
  PublicProfileLink,
  PublicProfileView,
  PublicProfileDelegation,
  UsernameAvailabilityResponse,
  BinaryResponse,
  AvatarResponse,

  // Account / Me
  ComputedState,
  MeEnvironmentParams,
  MeSearchBucket,
  MeSearchParams,
  MeSearchResults,
  PlatformSummary,
  ApiKeyMetadata,
  ApiKeyUsage,

  // Webhook event type
  WebhookEventType,

  // Config
  ProofOptions,
  WaitOptions,
  ConfirmAndWaitOptions,
} from './types.js';

// HITL E2E encryption crypto helpers
export {
  computeKid,
  generateKeyPair,
  generateEncryptionKeyPair,
  deriveKey,
  encryptMessage,
  encryptMessageV2,
  decryptMessage,
  encryptPrivateKey,
  decryptPrivateKey,
  validateMessageEnvelope,
  validatePrivateKeyEnvelope,
} from './crypto/hitl-crypto.js';
export type {
  CiphertextEnvelope,
  CiphertextEnvelopeV1,
  CiphertextEnvelopeV2,
  EncryptedPrivateKey,
  HitlKeyPair,
} from './crypto/hitl-crypto.js';

// Default export for convenience: import Proof from '@proof-holdings/sdk'
export { Proof as default } from './client.js';
