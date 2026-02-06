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
