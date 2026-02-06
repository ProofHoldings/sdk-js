export { ProofHoldings } from './client.js';
export { VERSION } from './version.js';

// Error classes
export {
  ProofHoldingsError,
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

  // Verification Requests
  RequestedAsset,
  VerificationRequestAsset,
  VerificationRequest,
  CreateVerificationRequestParams,
  ListVerificationRequestsParams,

  // Proofs
  ProofValidation,
  RevokedProof,
  RevocationList,
  RevokeResponse,
  OfflineVerificationResult,

  // Sessions
  Session,
  CreateSessionParams,

  // Webhook Deliveries
  WebhookDelivery,
  WebhookRetryResponse,
  WebhookDeliveryList,
  WebhookPagination,
  ListWebhookDeliveriesParams,

  // Config
  ProofHoldingsOptions,
  WaitOptions,
} from './types.js';

// Default export for convenience: import ProofHoldings from '@proof/sdk'
export { ProofHoldings as default } from './client.js';
