import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Verifications } from '../resources/verifications.js';
import { Sessions } from '../resources/sessions.js';
import { VerificationRequests } from '../resources/verification-requests.js';
import { PollingTimeoutError } from '../errors.js';

function mockHttp() {
  return {
    baseUrl: 'https://api.example.com',
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  } as unknown as HttpClient;
}

describe('Verifications.waitForCompletion', () => {
  it('returns immediately when already in terminal state', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ver_1', status: 'verified' });
    const v = new Verifications(http);

    const result = await v.waitForCompletion('ver_1', { interval: 10, timeout: 100 });

    expect(result.status).toBe('verified');
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('polls until status changes to terminal', async () => {
    const http = mockHttp();
    vi.mocked(http.get)
      .mockResolvedValueOnce({ id: 'ver_1', status: 'pending' })
      .mockResolvedValueOnce({ id: 'ver_1', status: 'pending' })
      .mockResolvedValueOnce({ id: 'ver_1', status: 'verified' });
    const v = new Verifications(http);

    const result = await v.waitForCompletion('ver_1', { interval: 10, timeout: 5000 });

    expect(result.status).toBe('verified');
    expect(http.get).toHaveBeenCalledTimes(3);
  });

  it('throws PollingTimeoutError on timeout', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ver_1', status: 'pending' });
    const v = new Verifications(http);

    await expect(
      v.waitForCompletion('ver_1', { interval: 10, timeout: 50 }),
    ).rejects.toThrow(PollingTimeoutError);
  });

  it('recognizes all verification terminal states', async () => {
    for (const status of ['verified', 'failed', 'expired', 'revoked']) {
      const http = mockHttp();
      vi.mocked(http.get).mockResolvedValue({ id: 'ver_1', status });
      const v = new Verifications(http);

      const result = await v.waitForCompletion('ver_1', { interval: 10, timeout: 100 });
      expect(result.status).toBe(status);
    }
  });

  it('respects AbortSignal', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ver_1', status: 'pending' });
    const v = new Verifications(http);

    const controller = new AbortController();
    controller.abort();

    await expect(
      v.waitForCompletion('ver_1', { interval: 10, timeout: 5000, signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe('Sessions.waitForCompletion', () => {
  it('returns immediately for terminal state', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ses_1', status: 'verified' });
    const s = new Sessions(http);

    const result = await s.waitForCompletion('ses_1', { interval: 10, timeout: 100 });
    expect(result.status).toBe('verified');
  });

  it('recognizes all session terminal states', async () => {
    for (const status of ['verified', 'failed', 'expired']) {
      const http = mockHttp();
      vi.mocked(http.get).mockResolvedValue({ id: 'ses_1', status });
      const s = new Sessions(http);

      const result = await s.waitForCompletion('ses_1', { interval: 10, timeout: 100 });
      expect(result.status).toBe(status);
    }
  });

  it('throws PollingTimeoutError on timeout', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ses_1', status: 'pending' });
    const s = new Sessions(http);

    await expect(
      s.waitForCompletion('ses_1', { interval: 10, timeout: 50 }),
    ).rejects.toThrow(PollingTimeoutError);
  });
});

describe('polling contract — backoff, jitter, cancellation', () => {
  it('interval grows between polls when backoff > 1', async () => {
    const http = mockHttp();
    let callCount = 0;
    vi.mocked(http.get).mockImplementation(async () => ({
      id: 'ver_1',
      status: ++callCount >= 4 ? 'verified' : 'pending',
    }));
    const v = new Verifications(http);

    const callTimes: number[] = [];
    vi.mocked(http.get).mockImplementation(async () => {
      callTimes.push(performance.now());
      return {
        id: 'ver_1',
        status: callTimes.length >= 4 ? 'verified' : 'pending',
      };
    });

    await v.waitForCompletion('ver_1', {
      interval: 20,
      timeout: 5000,
      backoff: 2,
      maxInterval: 1000,
      jitter: 0,
    });

    expect(callTimes.length).toBe(4);
    const gap1 = callTimes[1] - callTimes[0];
    const gap2 = callTimes[2] - callTimes[1];
    expect(gap2).toBeGreaterThan(gap1);
  });

  it('maxInterval caps backoff growth', async () => {
    const http = mockHttp();
    let callCount = 0;
    vi.mocked(http.get).mockImplementation(async () => ({
      id: 'ver_1',
      status: ++callCount >= 5 ? 'verified' : 'pending',
    }));
    const v = new Verifications(http);

    const start = performance.now();
    await v.waitForCompletion('ver_1', {
      interval: 10,
      timeout: 5000,
      backoff: 10,
      maxInterval: 50,
      jitter: 0,
    });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });

  it('AbortSignal abort between polls throws', async () => {
    const http = mockHttp();
    let callCount = 0;
    const controller = new AbortController();
    vi.mocked(http.get).mockImplementation(async () => {
      callCount++;
      if (callCount === 2) controller.abort();
      return { id: 'ver_1', status: 'pending' };
    });
    const v = new Verifications(http);

    await expect(
      v.waitForCompletion('ver_1', {
        interval: 10,
        timeout: 5000,
        backoff: 1,
        maxInterval: 50,
        jitter: 0,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});

describe('VerificationRequests.waitForCompletion', () => {
  it('returns immediately for terminal state', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'vr_1', status: 'completed' });
    const vr = new VerificationRequests(http);

    const result = await vr.waitForCompletion('vr_1', { interval: 10, timeout: 100 });
    expect(result.status).toBe('completed');
  });

  it('recognizes all request terminal states', async () => {
    for (const status of ['completed', 'expired', 'cancelled']) {
      const http = mockHttp();
      vi.mocked(http.get).mockResolvedValue({ id: 'vr_1', status });
      const vr = new VerificationRequests(http);

      const result = await vr.waitForCompletion('vr_1', { interval: 10, timeout: 100 });
      expect(result.status).toBe(status);
    }
  });

  it('throws PollingTimeoutError on timeout', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'vr_1', status: 'pending' });
    const vr = new VerificationRequests(http);

    await expect(
      vr.waitForCompletion('vr_1', { interval: 10, timeout: 50 }),
    ).rejects.toThrow(PollingTimeoutError);
  });
});
