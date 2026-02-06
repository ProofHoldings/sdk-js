import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Verifications } from '../resources/verifications.js';
import { Sessions } from '../resources/sessions.js';
import { VerificationRequests } from '../resources/verification-requests.js';
import { WebhookDeliveries } from '../resources/webhook-deliveries.js';

function mockHttp() {
  return {
    baseUrl: 'https://api.example.com',
    get: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  } as unknown as HttpClient;
}

describe('Verifications resource', () => {
  it('create sends POST to correct endpoint', async () => {
    const http = mockHttp();
    const mock = vi.mocked(http.post).mockResolvedValue({ id: 'ver_123', status: 'pending' });
    const v = new Verifications(http);

    await v.create({ type: 'phone', channel: 'whatsapp', identifier: '+1234567890' });

    expect(mock).toHaveBeenCalledWith('/api/v1/verifications', {
      type: 'phone',
      channel: 'whatsapp',
      identifier: '+1234567890',
    });
  });

  it('retrieve sends GET to correct endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ver_123' });
    const v = new Verifications(http);

    await v.retrieve('ver_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/verifications/ver_123');
  });

  it('retrieve encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const v = new Verifications(http);

    await v.retrieve('ver/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/verifications/ver%2Fspecial%26id');
  });

  it('list sends GET with query params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [], pagination: {} });
    const v = new Verifications(http);

    await v.list({ status: 'verified', limit: 10 });

    expect(http.get).toHaveBeenCalledWith('/api/v1/verifications', { status: 'verified', limit: 10 });
  });

  it('verify sends POST to verify endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ status: 'verified' });
    const v = new Verifications(http);

    await v.verify('ver_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/verifications/ver_123/verify');
  });

  it('submit sends POST with code', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ status: 'verified' });
    const v = new Verifications(http);

    await v.submit('ver_123', 'ABC123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/verifications/ver_123/submit', { code: 'ABC123' });
  });
});

describe('Sessions resource', () => {
  it('create sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'ses_123' });
    const s = new Sessions(http);

    await s.create({ channel: 'telegram' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/sessions', { channel: 'telegram' });
  });

  it('retrieve sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'ses_123', status: 'pending' });
    const s = new Sessions(http);

    await s.retrieve('ses_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/sessions/ses_123');
  });
});

describe('VerificationRequests resource', () => {
  it('create sends POST with assets', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'vr_123' });
    const vr = new VerificationRequests(http);

    await vr.create({
      assets: [{ type: 'phone', required: true }],
      reference_id: 'user_123',
    });

    expect(http.post).toHaveBeenCalledWith('/api/v1/verification-requests', {
      assets: [{ type: 'phone', required: true }],
      reference_id: 'user_123',
    });
  });

  it('cancel sends DELETE', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ status: 'cancelled' });
    const vr = new VerificationRequests(http);

    await vr.cancel('vr_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/verification-requests/vr_123');
  });

  it('list sends GET with filters', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const vr = new VerificationRequests(http);

    await vr.list({ status: 'pending', limit: 5 });

    expect(http.get).toHaveBeenCalledWith('/api/v1/verification-requests', { status: 'pending', limit: 5 });
  });
});

describe('WebhookDeliveries resource', () => {
  it('list sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ deliveries: [] });
    const wd = new WebhookDeliveries(http);

    await wd.list({ status: 'failed' });

    expect(http.get).toHaveBeenCalledWith('/api/v1/webhook-deliveries', { status: 'failed' });
  });

  it('retrieve sends GET with ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'del_123' });
    const wd = new WebhookDeliveries(http);

    await wd.retrieve('del_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/webhook-deliveries/del_123');
  });

  it('retry sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const wd = new WebhookDeliveries(http);

    await wd.retry('del_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/webhook-deliveries/del_123/retry');
  });
});
