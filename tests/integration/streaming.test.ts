import { describe, it, expect } from 'vitest';
import type { SSEEvent } from '../../src/index.js';
import { LIVE_MODE } from './helpers.js';

const itMockOnly = it.skipIf(LIVE_MODE);

// The SDK's streaming layer owns SSE frame parsing. Importing the internal
// parse helper gives us a focused integration test of the contract without
// spinning up a real HTTP SSE server. A black-box live test happens in the
// Playwright suite against staging-api.proof.holdings.
//
// Frame format (per whatwg EventSource):
//   id: <string>\n
//   event: <name>\n
//   data: <json>\n
//   \n
//
// We feed a small stream through the public streamEndpoint pipeline via a
// mocked fetch that returns a ReadableStream of SSE bytes, and assert the
// iterator yields SSEEvent objects shaped as documented.

import { streamEndpoint } from '../../src/streaming.js';
import { HttpClient } from '../../src/http.js';

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

describe('SSE streaming (integration)', () => {
  itMockOnly('parses id/event/data fields from a valid SSE stream', async () => {
    const frames = [
      'id: 1\nevent: status_changed\ndata: {"status":"pending"}\n\n',
      'id: 2\nevent: status_changed\ndata: {"status":"verified"}\n\n',
    ];
    const mockFetch = (async () => {
      return new Response(sseStream(frames), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }) as typeof fetch;

    const http = new HttpClient({
      apiKey: 'pk_test_x',
      baseUrl: 'https://mock.proof.test',
      timeout: 5000,
      maxRetries: 0,
      fetch: mockFetch,
    });

    const events: SSEEvent[] = [];
    for await (const event of streamEndpoint<{ status: string }>(http, {
      path: '/api/v1/stream',
      retrieve: async () => ({ status: 'pending' }),
      terminalStates: ['verified'],
      label: 'stream',
    })) {
      events.push(event);
      if ((event.data as { status?: string } | undefined)?.status === 'verified') break;
    }

    expect(events.length).toBeGreaterThanOrEqual(1);
    const statuses = events.map((e) => (e.data as { status?: string } | undefined)?.status);
    expect(statuses).toContain('verified');
  });

  itMockOnly('falls back to polling when SSE request fails and pollFallback is default', async () => {
    let pollCalls = 0;
    const mockFetch = (async (_url: RequestInfo | URL) => {
      return new Response('{"error":{"code":"sse_disabled","message":"no sse"}}', {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const http = new HttpClient({
      apiKey: 'pk_test_x',
      baseUrl: 'https://mock.proof.test',
      timeout: 5000,
      maxRetries: 0,
      fetch: mockFetch,
    });

    for await (const event of streamEndpoint<{ status: string }>(http, {
      path: '/api/v1/stream',
      retrieve: async () => {
        pollCalls += 1;
        return { status: 'verified' };
      },
      terminalStates: ['verified'],
      label: 'stream',
    })) {
      // Fallback yields at least one event then completes on terminal state.
      if ((event.data as { status?: string } | undefined)?.status === 'verified') break;
    }

    expect(pollCalls).toBeGreaterThanOrEqual(1);
  });
});
