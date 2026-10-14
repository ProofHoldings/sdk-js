import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Delegations } from '../resources/delegations.js';

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

const PH_DLG = 'ph_dlg_' + 'a'.repeat(32);
const PH_CTL = 'ph_ctl_' + 'b'.repeat(32);

describe('Delegations resource', () => {
  it('create sends POST with the typed delegate body and returns the token', async () => {
    const http = mockHttp();
    const mock = vi.mocked(http.post).mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      delegation_id: PH_DLG,
      status: 'active',
      token: 'eyJ.token.sig',
    });
    const d = new Delegations(http);

    const result = await d.create({
      control_proof: PH_CTL,
      delegate: { type: 'purl', value: 'pkg:npm/@postmark/mcp' },
      scope: ['email:send'],
      expires_in: 3600,
    });

    expect(mock).toHaveBeenCalledWith('/api/v1/delegations', {
      control_proof: PH_CTL,
      delegate: { type: 'purl', value: 'pkg:npm/@postmark/mcp' },
      scope: ['email:send'],
      expires_in: 3600,
    });
    expect(result.token).toBe('eyJ.token.sig');
  });

  it('list sends GET with query params and no token in items', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({
      data: [{ id: '507f1f77bcf86cd799439011', status: 'active' }],
      pagination: { page: 1, limit: 20, total: 1 },
    });
    const d = new Delegations(http);

    const result = await d.list({ page: 1, limit: 20, status: 'active' });

    expect(http.get).toHaveBeenCalledWith('/api/v1/delegations', { page: 1, limit: 20, status: 'active' });
    expect(result.data[0]).not.toHaveProperty('token');
  });

  it('retrieve accepts the ph_dlg_* handle and returns token + derived status', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      delegation_id: PH_DLG,
      token: 'eyJ.token.sig',
      effective_status: 'active',
      is_valid: true,
    });
    const d = new Delegations(http);

    const result = await d.retrieve(PH_DLG);

    expect(http.get).toHaveBeenCalledWith(`/api/v1/delegations/${PH_DLG}`);
    expect(result.token).toBe('eyJ.token.sig');
    expect(result.is_valid).toBe(true);
  });

  it('retrieve encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const d = new Delegations(http);

    await d.retrieve('dlg/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/delegations/dlg%2Fspecial%26id');
  });

  it('revoke sends POST to the revoke path with the reason body', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: '507f1f77bcf86cd799439011', status: 'revoked' });
    const d = new Delegations(http);

    await d.revoke('507f1f77bcf86cd799439011', { reason: 'key_compromise' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/delegations/507f1f77bcf86cd799439011/revoke', {
      reason: 'key_compromise',
    });
  });

  it('revoke without params sends POST with undefined body', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ status: 'revoked' });
    const d = new Delegations(http);

    await d.revoke(PH_DLG);

    expect(http.post).toHaveBeenCalledWith(`/api/v1/delegations/${PH_DLG}/revoke`, undefined);
  });
});
