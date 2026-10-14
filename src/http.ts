import { ProofError, NetworkError, TimeoutError } from './errors.js';
import type { ApiError } from './types.js';
import { VERSION } from './version.js';

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  fetch: typeof globalThis.fetch;
}

type QueryValue = string | number | boolean | undefined;

/**
 * Read a response body, giving up one byte past `limit`.
 *
 * `response.text()` would buffer the WHOLE body and measure afterwards, which is not a ceiling
 * at all for a reply that declares no length: a multi-gigabyte answer is fully in memory before
 * anything refuses it. Returns null when the body is over the limit.
 */
export async function readCapped(response: Response, limit: number): Promise<string | null> {
  const body = response.body;
  if (!body) {
    // No streamable body (a mocked or already-buffered response): fall back to reading it whole,
    // which is still bounded by whatever produced it. Measured in BYTES, like the streamed path
    // and like the ceiling itself — `text.length` counts UTF-16 units, which is a different
    // number for any non-ASCII body.
    const text = await response.text();
    return new TextEncoder().encode(text).byteLength > limit ? null : text;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let read = 0;
  let out = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      if (read > limit) return null;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return out + decoder.decode();
}

export class HttpClient {
  public readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config: HttpClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.timeout = config.timeout;
    this.maxRetries = config.maxRetries;
    this._fetch = config.fetch;
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, QueryValue>;
    },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.query);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await this._fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': `proof-sdk-js/${VERSION}`,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Rate limiting — retry with backoff
        if (response.status === 429 && attempt < this.maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.backoff(attempt);
          await this.sleep(delay);
          continue;
        }

        // Server errors — retry with backoff
        if (response.status >= 500 && attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt));
          continue;
        }

        // Non-JSON success (e.g. avatar images): return a {data, content_type}
        // envelope instead of attempting a JSON parse. Only when the server
        // EXPLICITLY declares a non-JSON content type — responses without a
        // Content-Type header keep the legacy JSON-parse path.
        const contentType = response.headers.get('content-type') ?? '';
        if (response.ok && contentType !== '' && !contentType.includes('application/json')) {
          const buf = await response.arrayBuffer();
          if (buf.byteLength > 0) {
            return { data: new Uint8Array(buf), content_type: contentType } as T;
          }
          return {} as T;
        }

        // Parse response body
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

        // Error responses
        if (!response.ok) {
          const apiError = body.error as ApiError | undefined;
          throw ProofError.fromResponse(response.status, apiError);
        }

        return body as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ProofError) throw error;

        lastError = error as Error;

        // Abort = timeout
        if (lastError.name === 'AbortError') {
          if (attempt < this.maxRetries) {
            await this.sleep(this.backoff(attempt));
            continue;
          }
          throw new TimeoutError(`Request to ${method} ${path} timed out after ${this.timeout}ms`);
        }

        // Network errors — retry
        if (attempt < this.maxRetries) {
          await this.sleep(this.backoff(attempt));
          continue;
        }
      }
    }

    throw new NetworkError(lastError?.message ?? 'Network request failed');
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>('GET', path, { query });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, { body });
  }

  del<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /**
   * Raw fetch with auth + user-agent headers applied. Used for SSE streaming
   * and other non-JSON responses. Does NOT retry, does NOT parse body, does
   * NOT apply the default request timeout — the caller owns lifecycle via
   * AbortSignal.
   */
  rawFetch(
    path: string,
    options: { headers?: Record<string, string>; signal?: AbortSignal; query?: Record<string, QueryValue> } = {},
  ): Promise<Response> {
    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `proof-sdk-js/${VERSION}`,
      ...(options.headers ?? {}),
    };
    return this._fetch(url, { method: 'GET', headers, signal: options.signal });
  }

  /**
   * Fetch a PUBLIC artifact by absolute url through the configured transport — no API key, no
   * retries, redirects refused.
   *
   * The key is left off deliberately rather than forgotten: the issuer's status list is a shared
   * document whose whole point is that reading it says nothing about WHICH proof is being checked
   * (`docs/api-map.yaml`, the status-list endpoint is public). Sending a credential with it would
   * hand the issuer the one fact the design withholds. Redirects are refused because the caller
   * has already decided the url's origin is trusted, and a redirect would move it.
   */
  fetchPublic(url: string, options: { timeoutMs: number; headers?: Record<string, string> }): Promise<Response> {
    return this._fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': `proof-sdk-js/${VERSION}`,
        ...(options.headers ?? {}),
      },
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  }

  private buildUrl(path: string, query?: Record<string, QueryValue>): string {
    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private backoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
