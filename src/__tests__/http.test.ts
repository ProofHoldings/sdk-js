import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import {
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
  TimeoutError,
} from '../errors.js';

function createMockFetch(responses: Array<{ status: number; body?: object; headers?: Record<string, string> }>) {
  let callIndex = 0;
  const fn = vi.fn(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: {
        get: (key: string) => resp.headers?.[key] ?? null,
      },
      json: async () => resp.body ?? {},
    } as unknown as Response;
  });
  return fn;
}

function makeClient(mockFetch: ReturnType<typeof createMockFetch>, maxRetries = 0) {
  return new HttpClient({
    apiKey: 'pk_test_123',
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    maxRetries,
    fetch: mockFetch as unknown as typeof globalThis.fetch,
  });
}

describe('HttpClient', () => {
  describe('successful requests', () => {
    it('sends GET with correct headers', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: 'ver_123' } }]);
      const client = makeClient(mockFetch);

      const result = await client.get<{ id: string }>('/api/v1/verifications/ver_123');

      expect(result).toEqual({ id: 'ver_123' });
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/api/v1/verifications/ver_123');
      expect(options.method).toBe('GET');
      expect(options.headers.Authorization).toBe('Bearer pk_test_123');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBeUndefined();
    });

    it('sends POST with JSON body', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { id: 'ver_new' } }]);
      const client = makeClient(mockFetch);

      await client.post('/api/v1/verifications', { type: 'phone', channel: 'whatsapp' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ type: 'phone', channel: 'whatsapp' });
    });

    it('sends DELETE', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { success: true } }]);
      const client = makeClient(mockFetch);

      await client.del('/api/v1/verification-requests/vr_123');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
    });

    it('appends query parameters', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { data: [] } }]);
      const client = makeClient(mockFetch);

      await client.get('/api/v1/verifications', { status: 'verified', limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('status=verified');
      expect(url).toContain('limit=10');
    });

    it('skips undefined query values', async () => {
      const mockFetch = createMockFetch([{ status: 200, body: { data: [] } }]);
      const client = makeClient(mockFetch);

      await client.get('/api/v1/verifications', { status: 'verified', type: undefined });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('status=verified');
      expect(url).not.toContain('type=');
    });
  });

  describe('error handling', () => {
    it('throws ValidationError on 400', async () => {
      const mockFetch = createMockFetch([{
        status: 400,
        body: { error: { code: 'invalid_param', message: 'Invalid type' } },
      }]);
      const client = makeClient(mockFetch);

      await expect(client.get('/test')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError on 404', async () => {
      const mockFetch = createMockFetch([{
        status: 404,
        body: { error: { code: 'not_found', message: 'Not found' } },
      }]);
      const client = makeClient(mockFetch);

      await expect(client.get('/test')).rejects.toThrow(NotFoundError);
    });

    it('throws ServerError on 500', async () => {
      const mockFetch = createMockFetch([{ status: 500, body: {} }]);
      const client = makeClient(mockFetch);

      await expect(client.get('/test')).rejects.toThrow(ServerError);
    });
  });

  describe('retry logic', () => {
    it('retries on 500 and succeeds', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: {} },
        { status: 200, body: { ok: true } },
      ]);
      const client = makeClient(mockFetch, 1);

      const result = await client.get<{ ok: boolean }>('/test');
      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 and succeeds', async () => {
      const mockFetch = createMockFetch([
        { status: 429, body: {}, headers: { 'Retry-After': '0' } },
        { status: 200, body: { ok: true } },
      ]);
      const client = makeClient(mockFetch, 1);

      const result = await client.get<{ ok: boolean }>('/test');
      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws RateLimitError after exhausting retries on 429', async () => {
      const mockFetch = createMockFetch([
        { status: 429, body: {} },
        { status: 429, body: {} },
      ]);
      const client = makeClient(mockFetch, 1);

      await expect(client.get('/test')).rejects.toThrow(RateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws ServerError after exhausting retries on 500', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: {} },
        { status: 500, body: {} },
        { status: 500, body: {} },
      ]);
      const client = makeClient(mockFetch, 2);

      await expect(client.get('/test')).rejects.toThrow(ServerError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on network error and succeeds', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error('ECONNREFUSED');
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ ok: true }),
        } as unknown as Response;
      });

      const client = new HttpClient({
        apiKey: 'pk_test',
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        maxRetries: 1,
        fetch: mockFetch as unknown as typeof globalThis.fetch,
      });

      const result = await client.get<{ ok: boolean }>('/test');
      expect(result).toEqual({ ok: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws NetworkError after exhausting retries on network error', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      });

      const client = new HttpClient({
        apiKey: 'pk_test',
        baseUrl: 'https://api.example.com',
        timeout: 5000,
        maxRetries: 0,
        fetch: mockFetch as unknown as typeof globalThis.fetch,
      });

      await expect(client.get('/test')).rejects.toThrow(NetworkError);
    });
  });
});
