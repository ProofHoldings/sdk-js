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
      case 401: return new AuthenticationError(message, code, details, requestId);
      case 403: return new ForbiddenError(message, code, details, requestId);
      case 404: return new NotFoundError(message, code, details, requestId);
      case 409: return new ConflictError(message, code, details, requestId);
      case 429: return new RateLimitError(message, code, details, requestId);
      default:
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
  constructor(message: string, code: string, details?: unknown, requestId?: string) {
    super(message, code, 429, details, requestId);
    this.name = 'RateLimitError';
  }
}

export class ServerError extends ProofError {
  constructor(message: string, code: string, statusCode: number = 500, details?: unknown, requestId?: string) {
    super(message, code, statusCode, details, requestId);
    this.name = 'ServerError';
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
