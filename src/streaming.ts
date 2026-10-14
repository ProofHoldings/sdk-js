import type { HttpClient } from './http.js';
import { PollingTimeoutError } from './errors.js';
import type { WaitOptions } from './types.js';

/**
 * Options accepted by every SDK `stream()` method.
 *
 * If the SSE connection fails (503 from the `ENABLE_SSE=false` kill-switch,
 * network error, or a runtime with no ReadableStream body), the iterator
 * transparently falls back to the standard polling contract. You can opt out
 * of the fallback with `pollFallback: false`.
 */
export interface StreamOptions extends WaitOptions {
  /**
   * Disable the automatic polling fallback. When `false`, SSE failures are
   * surfaced to the caller as a thrown error from the async iterator.
   * Defaults to `true`.
   */
  pollFallback?: boolean;
}

/**
 * Configuration for `streamEndpoint`. Callers supply a URL, a polling
 * fallback (must follow the standard polling contract), and terminal-state
 * metadata so the iterator knows when to stop emitting once a resource is
 * done.
 */
export interface StreamConfig<T extends object> {
  /** Absolute path on the API, e.g. `/api/v1/verifications/ver_123/events`. */
  path: string;
  /**
   * Fallback retrieve function for polling mode. Returns the full resource.
   * Only used when SSE fails / is disabled / is unsupported.
   */
  retrieve: () => Promise<T>;
  /**
   * Terminal states for this resource. When a polled resource enters one of
   * these states, the iterator yields it once and completes. For SSE, the
   * iterator completes when the server closes the stream — terminal-state
   * detection from event payloads is left to the caller.
   */
  terminalStates: readonly string[];
  /**
   * Additional terminal test for a polled resource whose own `status` cannot say it is done — an
   * asset that stays `pending` after its request was cancelled.
   */
  isTerminal?: (resource: T) => boolean;
  /** Human-readable label for error messages ("Verification ver_123"). */
  label: string;
}

/** Parsed SSE event (id + event name + JSON-parsed data). */
export interface SSEEvent<T = unknown> {
  id?: string;
  event: string;
  data: T;
}

/**
 * What a resource's `stream()` yields. A live SSE connection writes a `connected` signal, then
 * `TUpdateName` signals as the server publishes them — not necessarily one per status change, so
 * re-read the resource with its `retrieve()` rather than relying on the stream to report each one.
 * Neither signal carries the resource. Only the polling fallback yields the resource itself, as
 * `poll` events, and as a `terminal` one when it reaches a terminal status. Narrow on `event` before
 * reading `data`.
 */
export type StreamEvent<TUpdateName extends string, TConnected, TUpdate, TResource> =
  | { id?: string; event: 'connected'; data: TConnected }
  | { id?: string; event: TUpdateName; data: TUpdate }
  | { id?: string; event: 'poll' | 'terminal'; data: TResource };

/**
 * Open an SSE stream to `config.path` using `http.rawFetch` and yield
 * parsed events. On any failure (server returns 503, runtime lacks
 * `ReadableStream`, body read throws) and when `pollFallback !== false`, fall
 * back to polling `config.retrieve` under the standard polling contract.
 *
 * The returned async iterable is single-use. Consuming it via
 * `for await (...)` attaches an abort listener to `options.signal`; breaking
 * out of the loop or aborting the signal cleanly closes the connection — an
 * aborted signal ends the loop, it does not throw.
 */
export function streamEndpoint<T extends object, E extends SSEEvent<unknown> = SSEEvent<T>>(
  http: HttpClient,
  config: StreamConfig<T>,
  options?: StreamOptions,
): AsyncIterable<E> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<E> {
      return createStreamIterator(http, config, options) as unknown as AsyncIterator<E>;
    },
  };
}

function createStreamIterator<T extends object>(
  http: HttpClient,
  config: StreamConfig<T>,
  options?: StreamOptions,
): AsyncIterator<SSEEvent<T>> {
  const controller = new AbortController();
  const signal = options?.signal;
  const pollFallback = options?.pollFallback !== false;

  // Chain the caller's signal into our internal controller so that aborting
  // either one tears down the connection.
  let onExternalAbort: (() => void) | undefined;
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      onExternalAbort = () => controller.abort(signal.reason);
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const cleanup = () => {
    if (signal && onExternalAbort) {
      signal.removeEventListener('abort', onExternalAbort);
    }
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };

  // Lazy init: open SSE on first .next() call.
  let initialized = false;
  let innerIterator: AsyncIterator<SSEEvent<T>> | undefined;

  async function init(): Promise<void> {
    initialized = true;
    try {
      const response = await http.rawFetch(config.path, {
        headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        if (pollFallback) {
          innerIterator = pollingFallbackIterator(config, options, controller.signal);
          return;
        }
        throw new Error(
          `SSE stream for ${config.label} failed with status ${response.status}`,
        );
      }
      innerIterator = sseResponseIterator<T>(response, controller.signal);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      if (pollFallback) {
        innerIterator = pollingFallbackIterator(config, options, controller.signal);
        return;
      }
      throw err;
    }
  }

  const done = (): IteratorResult<SSEEvent<T>> => ({ done: true, value: undefined });

  return {
    async next(): Promise<IteratorResult<SSEEvent<T>>> {
      if (signal?.aborted) {
        cleanup();
        return done();
      }
      if (!initialized) {
        try {
          await init();
        } catch (err) {
          cleanup();
          if (signal?.aborted) return done();
          throw err;
        }
      }
      try {
        const result = await innerIterator!.next();
        if (result.done) cleanup();
        return result;
      } catch (err) {
        cleanup();
        if (signal?.aborted) return done();
        throw err;
      }
    },
    async return(value?: SSEEvent<T>): Promise<IteratorResult<SSEEvent<T>>> {
      cleanup();
      if (innerIterator?.return) {
        await innerIterator.return(value);
      }
      return { done: true, value: value as SSEEvent<T> };
    },
    async throw(err?: unknown): Promise<IteratorResult<SSEEvent<T>>> {
      cleanup();
      if (innerIterator?.throw) {
        return innerIterator.throw(err);
      }
      throw err;
    },
  };
}

/**
 * Parse a ReadableStream<Uint8Array> of SSE frames into discrete `SSEEvent`s.
 * Follows the WHATWG EventSource parsing rules: frames are terminated by a
 * blank line; each line is `field: value`; unknown fields ignored; comments
 * (`:`-prefixed lines) ignored.
 */
async function* sseResponseIterator<T>(
  response: Response,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent<T>, void, undefined> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  if (signal.aborted) {
    reader.cancel().catch(() => {});
    return;
  }
  signal.addEventListener('abort', onAbort, { once: true });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      // SSE frames are separated by a blank line — either \n\n or \r\n\r\n.
      while (
        (sep = findFrameBoundary(buffer)) !== -1
      ) {
        const rawFrame = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '');
        const parsed = parseFrame<T>(rawFrame);
        if (parsed) yield parsed;
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

function findFrameBoundary(buffer: string): number {
  const a = buffer.indexOf('\n\n');
  const b = buffer.indexOf('\r\n\r\n');
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function parseFrame<T>(frame: string): SSEEvent<T> | null {
  let id: string | undefined;
  let event = 'message';
  const dataLines: string[] = [];

  for (const rawLine of frame.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(':')) continue;
    const colon = rawLine.indexOf(':');
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    // Per SSE spec, a single space after the colon is stripped.
    let value = colon === -1 ? '' : rawLine.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'id': id = value; break;
      case 'event': event = value; break;
      case 'data': dataLines.push(value); break;
      default: /* ignore retry/unknown */ break;
    }
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    // Data is not JSON — surface as raw string; caller can coerce.
    data = raw as unknown as T;
  }
  return { id, event, data };
}

/**
 * Polling fallback. Wraps `pollUntilComplete` as an async iterator that
 * yields every intermediate poll as a synthetic SSE event (event name
 * `'poll'`), then yields a final `'terminal'` event when a terminal state is
 * reached. Matches the shape callers expect from the SSE path so code that
 * iterates events works identically in both modes.
 */
async function* pollingFallbackIterator<T extends object>(
  config: StreamConfig<T>,
  options: StreamOptions | undefined,
  internalSignal: AbortSignal,
): AsyncGenerator<SSEEvent<T>, void, undefined> {
  // Merge the caller's signal (from options) with the stream iterator's
  // internal abort controller so cancellation works from either source.
  const mergedController = new AbortController();
  const abortBoth = () => mergedController.abort(internalSignal.reason);
  if (internalSignal.aborted) {
    mergedController.abort(internalSignal.reason);
  } else {
    internalSignal.addEventListener('abort', abortBoth, { once: true });
  }
  if (options?.signal) {
    if (options.signal.aborted) {
      mergedController.abort(options.signal.reason);
    } else {
      options.signal.addEventListener(
        'abort',
        () => mergedController.abort(options.signal!.reason),
        { once: true },
      );
    }
  }

  // We can't easily interleave events from pollUntilComplete — so we
  // implement a streaming version: call retrieve, yield, check terminal,
  // sleep, repeat. This mirrors pollUntilComplete's contract (backoff,
  // jitter, timeout, abort) but yields each observation.
  const interval0 = options?.interval ?? 2000;
  const backoff = options?.backoff ?? 1.5;
  const maxInterval = options?.maxInterval ?? 30_000;
  const jitterMax = options?.jitter ?? 500;
  const timeout = options?.timeout ?? 600_000;
  const start = Date.now();
  let interval = interval0;

  while (true) {
    if (mergedController.signal.aborted) {
      throw mergedController.signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const resource = await config.retrieve();
    const status = (resource as { status?: string }).status;
    const isTerminal =
      (status != null && config.terminalStates.includes(status)) || (config.isTerminal?.(resource) ?? false);
    yield {
      event: isTerminal ? 'terminal' : 'poll',
      data: resource,
    };
    if (isTerminal) return;
    if (Date.now() - start >= timeout) {
      throw new PollingTimeoutError(
        `${config.label} did not complete within ${timeout}ms (last status: ${status ?? 'unknown'})`,
      );
    }
    const jitter = Math.random() * jitterMax;
    await sleepWithAbort(interval + jitter, mergedController.signal);
    interval = Math.min(interval * backoff, maxInterval);
  }
}

function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

