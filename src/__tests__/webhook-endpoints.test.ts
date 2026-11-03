import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { WebhookEndpoints } from '../resources/webhook-endpoints.js';
import { Profiles } from '../resources/profiles.js';
import { Proof } from '../client.js';

function mockHttp() {
  return {
    baseUrl: 'https://api.example.com',
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    request: vi.fn(),
  } as unknown as HttpClient;
}

const ENDPOINT = {
  id: '507f1f77bcf86cd799439011',
  url: 'https://hooks.example.com/proof',
  events: ['proof.*'],
  scope: 'all',
  profile_ids: [],
  status: 'active',
  description: null,
  legacy: false,
  secret_set: true,
  created_at: '2026-10-29T00:00:00.000Z',
  updated_at: '2026-10-29T00:00:00.000Z',
};

describe('WebhookEndpoints resource', () => {
  it('list sends GET /api/v1/webhook-endpoints with no query', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [ENDPOINT] });

    const result = await new WebhookEndpoints(http).list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/webhook-endpoints');
    expect(result.data[0].id).toBe(ENDPOINT.id);
  });

  it('create sends POST with the body and returns the one-time secret', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ ...ENDPOINT, secret: 'whsec_once' });
    const params = {
      url: 'https://hooks.example.com/proof',
      events: ['proof.*'],
      scope: 'selected' as const,
      profile_ids: ['507f1f77bcf86cd799439022'],
      description: 'prod',
    };

    const result = await new WebhookEndpoints(http).create(params);

    expect(http.post).toHaveBeenCalledWith('/api/v1/webhook-endpoints', params);
    expect(result.secret).toBe('whsec_once');
  });

  it('retrieve sends GET /api/v1/webhook-endpoints/:id', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue(ENDPOINT);

    const result = await new WebhookEndpoints(http).retrieve(ENDPOINT.id);

    expect(http.get).toHaveBeenCalledWith(`/api/v1/webhook-endpoints/${ENDPOINT.id}`);
    expect(result).not.toHaveProperty('secret');
  });

  it('update sends PATCH with the partial body', async () => {
    const http = mockHttp();
    vi.mocked(http.request).mockResolvedValue({ ...ENDPOINT, status: 'disabled' });

    await new WebhookEndpoints(http).update(ENDPOINT.id, { status: 'disabled', description: null });

    expect(http.request).toHaveBeenCalledWith(
      'PATCH',
      `/api/v1/webhook-endpoints/${ENDPOINT.id}`,
      { body: { status: 'disabled', description: null } },
    );
  });

  it('delete sends DELETE /api/v1/webhook-endpoints/:id and resolves to void', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue(undefined);

    const result = await new WebhookEndpoints(http).delete(ENDPOINT.id);

    expect(http.del).toHaveBeenCalledWith(`/api/v1/webhook-endpoints/${ENDPOINT.id}`);
    expect(result).toBeUndefined();
  });

  it('rotateSecret sends POST /:id/rotate-secret with no body and returns the new secret', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ ...ENDPOINT, secret: 'whsec_new' });

    const result = await new WebhookEndpoints(http).rotateSecret(ENDPOINT.id);

    expect(http.post).toHaveBeenCalledWith(`/api/v1/webhook-endpoints/${ENDPOINT.id}/rotate-secret`);
    expect(result.secret).toBe('whsec_new');
  });

  it('encodes special characters in the id', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    vi.mocked(http.post).mockResolvedValue({});
    vi.mocked(http.del).mockResolvedValue(undefined);
    vi.mocked(http.request).mockResolvedValue({});
    const endpoints = new WebhookEndpoints(http);

    await endpoints.retrieve('a/b?c');
    await endpoints.update('a/b?c', { status: 'active' });
    await endpoints.delete('a/b?c');
    await endpoints.rotateSecret('a/b?c');

    expect(http.get).toHaveBeenCalledWith('/api/v1/webhook-endpoints/a%2Fb%3Fc');
    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/v1/webhook-endpoints/a%2Fb%3Fc', { body: { status: 'active' } });
    expect(http.del).toHaveBeenCalledWith('/api/v1/webhook-endpoints/a%2Fb%3Fc');
    expect(http.post).toHaveBeenCalledWith('/api/v1/webhook-endpoints/a%2Fb%3Fc/rotate-secret');
  });

  it('is wired on the client as webhookEndpoints', () => {
    const proof = new Proof('pk_test_x', { fetch: vi.fn() as unknown as typeof fetch });
    expect(proof.webhookEndpoints).toBeInstanceOf(WebhookEndpoints);
  });
});

describe('Profiles.rotateCallbackSecret', () => {
  it('sends POST /api/v1/profiles/profiles/:profileId/callback-secret/rotate with no body', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ profile_id: 'prof_1', secret: 'cbsec_new' });

    const result = await new Profiles(http).rotateCallbackSecret('prof/1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/profiles/profiles/prof%2F1/callback-secret/rotate');
    expect(result).toEqual({ profile_id: 'prof_1', secret: 'cbsec_new' });
  });
});
