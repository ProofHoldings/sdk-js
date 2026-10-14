import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Verifications } from '../resources/verifications.js';
import { Confirmations } from '../resources/confirmations.js';
import { AuthSessions } from '../resources/auth-sessions.js';
import { Me } from '../resources/me.js';
import { HitlChatIdDiscovery } from '../resources/hitl-chat-id.js';
import { VerificationRequests } from '../resources/verification-requests.js';
import type { SSEEvent } from '../streaming.js';

// ----------------------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------------------

/**
 * Build a mock `fetch` that returns an SSE-shaped Response. Frames are emitted
 * one-per-chunk to exercise the multi-chunk decode path.
 */
function makeSSEResponse(frames: string[]): Response {
  let i = 0;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= frames.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(frames[i]));
      i++;
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function makeErrorResponse(status: number): Response {
  return new Response(JSON.stringify({ error: { code: 'sse_disabled', message: 'SSE disabled' } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeJSONResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function frame(event: string, data: unknown, id?: string): string {
  const idLine = id !== undefined ? `id: ${id}\n` : '';
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function mkClient(fetchImpl: typeof globalThis.fetch): HttpClient {
  return new HttpClient({
    apiKey: 'pk_test_123',
    baseUrl: 'https://api.example.com',
    timeout: 5000,
    maxRetries: 0,
    fetch: fetchImpl,
  });
}

async function take<T>(iter: AsyncIterable<T>, n: number, signal?: AbortController): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) {
    out.push(v);
    if (out.length >= n) {
      if (signal) signal.abort();
      break;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Core SSE parsing
// ----------------------------------------------------------------------------

describe('streamEndpoint — SSE parsing', () => {
  it('yields events in order from a simulated SSE stream', async () => {
    const fetchMock = vi.fn(async () =>
      makeSSEResponse([
        frame('connected', { id: 'ver_1', status: 'pending' }, '0'),
        frame('status_changed', { id: 'ver_1', status: 'verified' }, '1'),
      ]),
    );
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);

    const out: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1')) {
      out.push(ev);
      if (ev.event === 'status_changed') break;
    }

    expect(out).toHaveLength(2);
    expect(out[0].event).toBe('connected');
    expect(out[0].id).toBe('0');
    expect((out[0].data as Record<string, unknown>).status).toBe('pending');
    expect(out[1].event).toBe('status_changed');
    expect((out[1].data as Record<string, unknown>).status).toBe('verified');
  });

  it('handles frames split across multiple chunks', async () => {
    const full = frame('update', { n: 1 }) + frame('update', { n: 2 });
    // Split at an arbitrary mid-frame byte so we exercise the buffer re-read.
    const split = Math.floor(full.length / 3);
    const fetchMock = vi.fn(async () =>
      makeSSEResponse([full.slice(0, split), full.slice(split, split * 2), full.slice(split * 2)]),
    );
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);

    const events: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1')) events.push(ev);
    expect(events.map((e) => (e.data as { n: number }).n)).toEqual([1, 2]);
  });

  it('ignores comment lines and unknown fields', async () => {
    const fetchMock = vi.fn(async () =>
      makeSSEResponse([
        ':keepalive\n\n',
        'retry: 5000\nevent: update\ndata: {"ok":true}\n\n',
      ]),
    );
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);
    const events: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1')) events.push(ev);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('update');
    expect(events[0].data).toEqual({ ok: true });
  });
});

// ----------------------------------------------------------------------------
// AbortSignal handling
// ----------------------------------------------------------------------------

describe('streamEndpoint — AbortSignal', () => {
  it('stops yielding when the external AbortSignal fires', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      // Simulate a long-running stream that respects the signal.
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          let n = 0;
          const i = setInterval(() => {
            controller.enqueue(enc.encode(frame('tick', { n: ++n })));
          }, 5);
          const abort = () => {
            clearInterval(i);
            controller.close();
          };
          if (init.signal) {
            if (init.signal.aborted) abort();
            else init.signal.addEventListener('abort', abort, { once: true });
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);
    const ctl = new AbortController();

    const events = await take(v.stream('ver_1', { signal: ctl.signal }), 3, ctl);
    expect(events.length).toBe(3);
    expect((events[0].data as { n: number }).n).toBe(1);
  });

  it('pre-aborted signal terminates iterator quickly', async () => {
    const fetchMock = vi.fn(async () => makeSSEResponse([frame('update', { a: 1 })]));
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);

    const ctl = new AbortController();
    ctl.abort();

    const events: SSEEvent[] = [];
    // Pre-aborted signal may either throw AbortError or simply yield nothing —
    // both are acceptable; assert we don't hang or yield post-abort data.
    try {
      for await (const ev of v.stream('ver_1', { signal: ctl.signal })) {
        events.push(ev);
      }
    } catch (err) {
      expect((err as Error).name).toMatch(/Abort|AbortError/);
    }
    // At most the single buffered event may have leaked through before the
    // iterator realised the signal was aborted.
    expect(events.length).toBeLessThanOrEqual(1);
  });
});

describe('streamEndpoint — abort ends the loop cleanly', () => {
  function abortableSSE(init: RequestInit): Response {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frame('connected', { status: 'pending' }, '0')));
        // What a real fetch does: the body errors with the abort reason.
        init.signal?.addEventListener(
          'abort',
          () => controller.error(new DOMException('This operation was aborted', 'AbortError')),
          { once: true },
        );
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }

  it('SSE mode: aborting while the loop awaits the next frame ends it without throwing', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => abortableSSE(init));
    const v = new Verifications(mkClient(fetchMock as unknown as typeof globalThis.fetch));
    const ctl = new AbortController();

    const events: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1', { signal: ctl.signal })) {
      events.push(ev);
      setTimeout(() => ctl.abort(), 10);
    }

    expect(events.map((e) => e.event)).toEqual(['connected']);
  });

  it('polling mode: aborting during the wait between polls ends the loop without throwing', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/events') ? makeErrorResponse(503) : makeJSONResponse({ id: 'ver_1', status: 'pending' }),
    );
    const v = new Verifications(mkClient(fetchMock as unknown as typeof globalThis.fetch));
    const ctl = new AbortController();

    const events: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1', { signal: ctl.signal, interval: 1000, jitter: 0, timeout: 60_000 })) {
      events.push(ev);
      setTimeout(() => ctl.abort(), 10);
    }

    expect(events.map((e) => e.event)).toEqual(['poll']);
  });

  it('a signal aborted before the first read yields nothing and does not throw', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      if (init.signal?.aborted) throw new DOMException('This operation was aborted', 'AbortError');
      return makeSSEResponse([frame('update', { a: 1 })]);
    });
    const v = new Verifications(mkClient(fetchMock as unknown as typeof globalThis.fetch));
    const ctl = new AbortController();
    ctl.abort();

    const events: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1', { signal: ctl.signal })) events.push(ev);

    expect(events).toEqual([]);
  });

  it('still throws PollingTimeoutError when the polling fallback times out', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/events') ? makeErrorResponse(503) : makeJSONResponse({ id: 'ver_1', status: 'pending' }),
    );
    const v = new Verifications(mkClient(fetchMock as unknown as typeof globalThis.fetch));

    await expect(async () => {
      for await (const _ev of v.stream('ver_1', { interval: 5, backoff: 1, jitter: 0, timeout: 20 })) {
        // drain
      }
    }).rejects.toThrow(/did not complete within/);
  });
});

// ----------------------------------------------------------------------------
// Polling fallback
// ----------------------------------------------------------------------------

describe('streamEndpoint — polling fallback', () => {
  it('falls back to polling when SSE returns 503', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      calls++;
      if (url.endsWith('/events')) {
        return makeErrorResponse(503);
      }
      // Polling: pending -> pending -> verified
      const step = calls - 1; // first call was the 503 SSE attempt
      const status = step >= 3 ? 'verified' : 'pending';
      return makeJSONResponse({ id: 'ver_1', status });
    });
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);

    const events: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1', {
      interval: 5,
      backoff: 1,
      maxInterval: 5,
      jitter: 0,
      timeout: 5000,
    })) {
      events.push(ev);
    }

    // Expect at least one 'poll' and a terminal 'terminal' event.
    const terminal = events.find((e) => e.event === 'terminal');
    expect(terminal).toBeDefined();
    expect((terminal!.data as { status: string }).status).toBe('verified');
    expect(events.filter((e) => e.event === 'poll').length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to polling when SSE fetch throws a network error', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      calls++;
      if (url.endsWith('/events')) throw new Error('ECONNREFUSED');
      return makeJSONResponse({ id: 'ver_1', status: 'verified' });
    });
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);

    const out: SSEEvent[] = [];
    for await (const ev of v.stream('ver_1', {
      interval: 5, backoff: 1, maxInterval: 5, jitter: 0, timeout: 1000,
    })) out.push(ev);
    expect(out[out.length - 1].event).toBe('terminal');
  });

  it('streamAsset: ends as terminal when the request is cancelled though the asset is still pending', async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.endsWith('/events')) return makeErrorResponse(503);
      return makeJSONResponse({ asset_index: 0, status: 'pending', request_status: 'cancelled' });
    });
    const vr = new VerificationRequests(mkClient(fetchMock as unknown as typeof globalThis.fetch));

    const events: SSEEvent[] = [];
    for await (const ev of vr.streamAsset('vr_1', 0, { interval: 5, jitter: 0, timeout: 1000 })) events.push(ev);

    expect(events.map((e) => e.event)).toEqual(['terminal']);
    expect(urls[1]).toBe('https://api.example.com/api/v1/verify/request/vr_1/assets/0/status');
  });

  it('streamAsset: ends as terminal when the request has expired', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/events')
        ? makeErrorResponse(503)
        : makeJSONResponse({ asset_index: 0, status: 'pending', request_status: 'expired' }),
    );
    const vr = new VerificationRequests(mkClient(fetchMock as unknown as typeof globalThis.fetch));

    const events: SSEEvent[] = [];
    for await (const ev of vr.streamAsset('vr_1', 0, { interval: 5, jitter: 0, timeout: 1000 })) events.push(ev);

    expect(events.map((e) => e.event)).toEqual(['terminal']);
  });

  it('surfaces SSE errors when pollFallback: false', async () => {
    const fetchMock = vi.fn(async () => makeErrorResponse(503));
    const http = mkClient(fetchMock as unknown as typeof globalThis.fetch);
    const v = new Verifications(http);

    await expect(async () => {
      for await (const _ev of v.stream('ver_1', { pollFallback: false })) {
        // unreachable
      }
    }).rejects.toThrow(/failed with status 503/);
  });
});

// ----------------------------------------------------------------------------
// URL formation — one test per endpoint
// ----------------------------------------------------------------------------

describe('stream() URL formation — one per endpoint', () => {
  function interceptURL(): { fetch: typeof globalThis.fetch; urls: string[] } {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      // Minimal valid SSE response that immediately closes.
      return makeSSEResponse([frame('connected', { status: 'pending' })]);
    }) as unknown as typeof globalThis.fetch;
    return { fetch: fetchImpl, urls };
  }

  async function drain(iter: AsyncIterable<unknown>) {
    for await (const _ev of iter) { /* consume */ }
  }

  it('verifications: /api/v1/verifications/:id/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new Verifications(http).stream('ver_abc'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/verifications/ver_abc/events');
  });

  it('confirmations: /api/v1/confirmations/:id/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new Confirmations(http).stream('conf_abc'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/confirmations/conf_abc/events');
  });

  it('auth sessions: /api/v1/auth/sessions/:id/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new AuthSessions(http).stream('auth_abc'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/auth/sessions/auth_abc/events');
  });

  it('me 2fa: /api/v1/me/2fa/:sessionId/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new Me(http).stream2FASession('2fa_abc'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/me/2fa/2fa_abc/events');
  });

  it('me phones add: /api/v1/me/phones/add/:sessionId/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new Me(http).streamPhoneAddSession('sess_p'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/me/phones/add/sess_p/events');
  });

  it('me emails add: /api/v1/me/emails/add/:sessionId/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new Me(http).streamEmailAddSession('sess_e'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/me/emails/add/sess_e/events');
  });

  it('hitl chat-id-discovery: /api/v1/hitl/chat-id-discovery/:token/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new HitlChatIdDiscovery(http).stream('tok_123'));
    expect(urls[0]).toBe('https://api.example.com/api/v1/hitl/chat-id-discovery/tok_123/events');
  });

  it('verify request asset: /api/v1/verify/request/:id/assets/:idx/events', async () => {
    const { fetch, urls } = interceptURL();
    const http = mkClient(fetch);
    await drain(new VerificationRequests(http).streamAsset('vr_1', 2));
    expect(urls[0]).toBe('https://api.example.com/api/v1/verify/request/vr_1/assets/2/events');
  });

  it('sends Accept: text/event-stream and Bearer auth', async () => {
    const captured: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      captured.push({ url, headers: init.headers as Record<string, string> });
      return makeSSEResponse([frame('connected', {})]);
    });
    const http = mkClient(fetchImpl as unknown as typeof globalThis.fetch);
    await drain(new Verifications(http).stream('ver_1'));
    expect(captured[0].headers['Accept']).toBe('text/event-stream');
    expect(captured[0].headers['Authorization']).toBe('Bearer pk_test_123');
  });
});
