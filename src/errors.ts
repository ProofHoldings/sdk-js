import type { ApiError } from './types.js';

export class ProofError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = 'ProofError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static fromResponse(statusCode: number, error?: ApiError): ProofError {
    const code = error?.code ?? `http_${statusCode}`;
    const message = error?.message ?? `Request failed with status ${statusCode}`;
    const details = error?.details;
    const requestId = error?.request_id;

    switch (statusCode) {
      case 400: return new ValidationError(message, code, details, requestId);
      case 402:
        return error
          ? BalanceEmptyError.fromApiError(error)
          : new BalanceEmptyError(message, code, details, requestId);
      case 401: return new AuthenticationError(message, code, details, requestId);
      case 403: return new ForbiddenError(message, code, details, requestId);
      case 404: return new NotFoundError(message, code, details, requestId);
      case 409: return new ConflictError(message, code, details, requestId);
      case 429:
        return error
          ? RateLimitError.fromApiError(error)
          : new RateLimitError(message, code, details, requestId);
      default:
        if (code === BILLING_UNAVAILABLE) return new BillingUnavailableError(message, statusCode, details, requestId);
        if (statusCode >= 500) return new ServerError(message, code, statusCode, details, requestId);
        return new ProofError(message, code, statusCode, details, requestId);
    }
  }
}

export class ValidationError extends ProofError {
  constructor(message: string, code: string, details?: unknown, requestId?: string) {
    super(message, code, 400, details, requestId);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ProofError {
  constructor(message: string, code: string, details?: unknown, requestId?: string) {
    super(message, code, 401, details, requestId);
    this.name = 'AuthenticationError';
  }
}

export class ForbiddenError extends ProofError {
  constructor(message: string, code: string, details?: unknown, requestId?: string) {
    super(message, code, 403, details, requestId);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ProofError {
  constructor(message: string, code: string, details?: unknown, requestId?: string) {
    super(message, code, 404, details, requestId);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ProofError {
  constructor(message: string, code: string, details?: unknown, requestId?: string) {
    super(message, code, 409, details, requestId);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ProofError {
  /** Seconds to wait before retrying (from error response retryAfter field) */
  public readonly retryAfter?: number;
  /** Number of remaining attempts before lockout (auth endpoints only) */
  public readonly remainingAttempts?: number;

  constructor(
    message: string,
    code: string,
    details?: unknown,
    requestId?: string,
    retryAfter?: number,
    remainingAttempts?: number,
  ) {
    super(message, code, 429, details, requestId);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.remainingAttempts = remainingAttempts;
  }

  static fromApiError(error: ApiError): RateLimitError {
    return new RateLimitError(
      error.message, error.code, error.details,
      error.request_id, error.retryAfter, error.remaining_attempts,
    );
  }
}

export class ServerError extends ProofError {
  constructor(message: string, code: string, statusCode: number = 500, details?: unknown, requestId?: string) {
    super(message, code, statusCode, details, requestId);
    this.name = 'ServerError';
  }
}

/** The code of the billing kill switch's refusal: checkout, portal and top-up while billing is not live. */
export const BILLING_UNAVAILABLE = 'billing_unavailable';

/**
 * `503 billing_unavailable` — billing is not live, so checkout, the billing portal and top-ups are
 * refused. A ServerError, so an existing `instanceof ServerError` still matches it; unlike other 5xx
 * answers it is never retried, because asking again cannot change it.
 */
export class BillingUnavailableError extends ServerError {
  constructor(message: string, statusCode: number = 503, details?: unknown, requestId?: string) {
    super(message, BILLING_UNAVAILABLE, statusCode, details, requestId);
    this.name = 'BillingUnavailableError';
  }
}

/**
 * `402 balance_empty` — the account has used the proofs its plan includes this month and its prepaid
 * balance is at or below zero, so new proof requests are refused until it tops up. Any method that
 * creates a proof request can raise it, once billing is live; proofs already issued keep working.
 */
export class BalanceEmptyError extends ProofError {
  /** Where the owner tops up the balance */
  public readonly topUpUrl?: string;
  /** This period's production proofs */
  public readonly used?: number;
  /** Proofs the plan includes per period */
  public readonly included?: number;
  /** The prepaid balance in euro cents, at or below zero */
  public readonly balance?: number;

  constructor(
    message: string,
    code: string,
    details?: unknown,
    requestId?: string,
    fields: { topUpUrl?: string; used?: number; included?: number; balance?: number } = {},
  ) {
    super(message, code, 402, details, requestId);
    this.name = 'BalanceEmptyError';
    this.topUpUrl = fields.topUpUrl;
    this.used = fields.used;
    this.included = fields.included;
    this.balance = fields.balance;
  }

  static fromApiError(error: ApiError): BalanceEmptyError {
    return new BalanceEmptyError(error.message, error.code, error.details, error.request_id, {
      topUpUrl: error.top_up_url,
      used: error.used,
      included: error.included,
      balance: error.balance,
    });
  }
}

export class NetworkError extends ProofError {
  constructor(message: string) {
    super(message, 'network_error', 0);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ProofError {
  constructor(message: string = 'Request timed out') {
    super(message, 'timeout', 0);
    this.name = 'TimeoutError';
  }
}

export class PollingTimeoutError extends ProofError {
  constructor(message: string = 'Polling timed out waiting for completion') {
    super(message, 'polling_timeout', 0);
    this.name = 'PollingTimeoutError';
  }
}

export class ConfirmationDeniedError extends ProofError {
  /** ID of the confirmation that triggered the error */
  public readonly confirmationId: string;
  /** Non-approved terminal status that triggered the error ('denied' or, for the createAndWait gate, 'expired') */
  public readonly status: string;

  constructor(confirmationId: string, status: string = 'denied') {
    super(`Confirmation ${confirmationId} was ${status}`, 'confirmation_denied', 0);
    this.name = 'ConfirmationDeniedError';
    this.confirmationId = confirmationId;
    this.status = status;
  }
}
