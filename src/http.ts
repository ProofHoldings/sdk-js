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

  del<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
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
