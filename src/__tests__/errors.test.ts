import { describe, it, expect } from 'vitest';
import {
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
} from '../errors.js';

describe('ProofHoldingsError.fromResponse', () => {
  it('maps 400 to ValidationError', () => {
    const err = ProofHoldingsError.fromResponse(400, { code: 'invalid_param', message: 'Bad input' });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('invalid_param');
    expect(err.message).toBe('Bad input');
  });

  it('maps 401 to AuthenticationError', () => {
    const err = ProofHoldingsError.fromResponse(401);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.statusCode).toBe(401);
  });

  it('maps 403 to ForbiddenError', () => {
    const err = ProofHoldingsError.fromResponse(403);
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it('maps 404 to NotFoundError', () => {
    const err = ProofHoldingsError.fromResponse(404, { code: 'not_found', message: 'Not found' });
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('maps 409 to ConflictError', () => {
    const err = ProofHoldingsError.fromResponse(409);
    expect(err).toBeInstanceOf(ConflictError);
  });

  it('maps 429 to RateLimitError', () => {
    const err = ProofHoldingsError.fromResponse(429);
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it('maps 500 to ServerError', () => {
    const err = ProofHoldingsError.fromResponse(500);
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(500);
  });

  it('maps 502 to ServerError with correct status', () => {
    const err = ProofHoldingsError.fromResponse(502);
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(502);
  });

  it('uses defaults when no error body provided', () => {
    const err = ProofHoldingsError.fromResponse(418);
    expect(err.code).toBe('http_418');
    expect(err.message).toBe('Request failed with status 418');
  });

  it('preserves details and request_id', () => {
    const err = ProofHoldingsError.fromResponse(400, {
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
  it('all errors extend ProofHoldingsError', () => {
    expect(new ValidationError('', '', undefined)).toBeInstanceOf(ProofHoldingsError);
    expect(new AuthenticationError('', '', undefined)).toBeInstanceOf(ProofHoldingsError);
    expect(new ForbiddenError('', '', undefined)).toBeInstanceOf(ProofHoldingsError);
    expect(new NotFoundError('', '', undefined)).toBeInstanceOf(ProofHoldingsError);
    expect(new ConflictError('', '', undefined)).toBeInstanceOf(ProofHoldingsError);
    expect(new RateLimitError('', '', undefined)).toBeInstanceOf(ProofHoldingsError);
    expect(new ServerError('', '', 500)).toBeInstanceOf(ProofHoldingsError);
    expect(new NetworkError('')).toBeInstanceOf(ProofHoldingsError);
    expect(new TimeoutError()).toBeInstanceOf(ProofHoldingsError);
    expect(new PollingTimeoutError()).toBeInstanceOf(ProofHoldingsError);
  });

  it('all errors extend Error', () => {
    expect(new ProofHoldingsError('', '', 0)).toBeInstanceOf(Error);
    expect(new PollingTimeoutError()).toBeInstanceOf(Error);
  });
});
