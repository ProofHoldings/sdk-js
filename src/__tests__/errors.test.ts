import { describe, it, expect } from 'vitest';
import {
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
} from '../errors.js';

describe('ProofError.fromResponse', () => {
  it('maps 400 to ValidationError', () => {
    const err = ProofError.fromResponse(400, { code: 'invalid_param', message: 'Bad input' });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('invalid_param');
    expect(err.message).toBe('Bad input');
  });

  it('maps 401 to AuthenticationError', () => {
    const err = ProofError.fromResponse(401);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.statusCode).toBe(401);
  });

  it('maps 403 to ForbiddenError', () => {
    const err = ProofError.fromResponse(403);
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it('maps 404 to NotFoundError', () => {
    const err = ProofError.fromResponse(404, { code: 'not_found', message: 'Not found' });
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('maps 409 to ConflictError', () => {
    const err = ProofError.fromResponse(409);
    expect(err).toBeInstanceOf(ConflictError);
  });

  it('maps 429 to RateLimitError', () => {
    const err = ProofError.fromResponse(429);
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it('maps 429 with retryAfter and remaining_attempts to RateLimitError', () => {
    const err = ProofError.fromResponse(429, {
      code: 'auth_lockout',
      message: 'Too many attempts',
      retryAfter: 3600,
      remaining_attempts: 0,
    });
    expect(err).toBeInstanceOf(RateLimitError);
    const rateLimitErr = err as RateLimitError;
    expect(rateLimitErr.retryAfter).toBe(3600);
    expect(rateLimitErr.remainingAttempts).toBe(0);
    expect(rateLimitErr.code).toBe('auth_lockout');
  });

  it('maps 500 to ServerError', () => {
    const err = ProofError.fromResponse(500);
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(500);
  });

  it('maps 502 to ServerError with correct status', () => {
    const err = ProofError.fromResponse(502);
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(502);
  });

  it('uses defaults when no error body provided', () => {
    const err = ProofError.fromResponse(418);
    expect(err.code).toBe('http_418');
    expect(err.message).toBe('Request failed with status 418');
  });

  it('preserves details and request_id', () => {
    const err = ProofError.fromResponse(400, {
      code: 'validation',
      message: 'Bad',
      details: { field: 'email' },
      request_id: 'req_abc',
    });
    expect(err.details).toEqual({ field: 'email' });
    expect(err.requestId).toBe('req_abc');
  });
});

describe('Error hierarchy', () => {
  it('all errors extend ProofError', () => {
    expect(new ValidationError('', '', undefined)).toBeInstanceOf(ProofError);
    expect(new AuthenticationError('', '', undefined)).toBeInstanceOf(ProofError);
    expect(new ForbiddenError('', '', undefined)).toBeInstanceOf(ProofError);
    expect(new NotFoundError('', '', undefined)).toBeInstanceOf(ProofError);
    expect(new ConflictError('', '', undefined)).toBeInstanceOf(ProofError);
    expect(new RateLimitError('', '', undefined)).toBeInstanceOf(ProofError);
    expect(new ServerError('', '', 500)).toBeInstanceOf(ProofError);
    expect(new NetworkError('')).toBeInstanceOf(ProofError);
    expect(new TimeoutError()).toBeInstanceOf(ProofError);
    expect(new PollingTimeoutError()).toBeInstanceOf(ProofError);
  });

  it('all errors extend Error', () => {
    expect(new ProofError('', '', 0)).toBeInstanceOf(Error);
    expect(new PollingTimeoutError()).toBeInstanceOf(Error);
  });
});
