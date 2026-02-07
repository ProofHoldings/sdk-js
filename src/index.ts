export { Proof } from './client.js';
export { VERSION } from './version.js';

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
  ProofOptions,
  WaitOptions,
} from './types.js';

/** @deprecated Use `ProofOptions` instead. Will be removed in v2.0. */
export type { ProofOptions as ProofHoldingsOptions } from './types.js';

// Default export for convenience: import Proof from '@proof/sdk'
export { Proof as default } from './client.js';
