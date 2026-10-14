import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Verifications } from '../resources/verifications.js';
import { Sessions } from '../resources/sessions.js';
import { VerificationRequests } from '../resources/verification-requests.js';
import { WebhookDeliveries } from '../resources/webhook-deliveries.js';
import { Hitl } from '../resources/hitl.js';
import { HitlChatIdDiscovery } from '../resources/hitl-chat-id.js';
import { Confirmations } from '../resources/confirmations.js';
import { Templates } from '../resources/templates.js';
import { Profiles } from '../resources/profiles.js';
import { PublicProfiles } from '../resources/public-profiles.js';
import { Me } from '../resources/me.js';

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

  it('createMultiChannel sends POST to multi-channel endpoint', async () => {
    const http = mockHttp();
    const mock = vi.mocked(http.post).mockResolvedValue({ group_id: 'vg_abc', status: 'pending' });
    const v = new Verifications(http);

    await v.createMultiChannel({ type: 'phone', identifier: '+1234567890', channels: ['whatsapp', 'sms'] });

    expect(mock).toHaveBeenCalledWith('/api/v1/verifications/multi-channel', {
      type: 'phone',
      identifier: '+1234567890',
      channels: ['whatsapp', 'sms'],
    });
  });

  it('getMultiChannelStatus sends GET to group status endpoint', async () => {
    const http = mockHttp();
    const mock = vi
      .mocked(http.get)
      .mockResolvedValue({ group_id: 'vg_abc', status: 'pending', winning_channel: null, channels: [] });
    const v = new Verifications(http);

    await v.getMultiChannelStatus('vg_abc123');

    expect(mock).toHaveBeenCalledWith('/api/v1/verifications/multi-channel/vg_abc123/status');
  });

  it('getMultiChannelStatus URL-encodes the group id', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const v = new Verifications(http);

    await v.getMultiChannelStatus('vg/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/verifications/multi-channel/vg%2Fspecial%26id/status');
  });

  it('deleteDomainVerification sends DELETE to the URL-encoded domain verification', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue(undefined);
    const v = new Verifications(http);

    await v.deleteDomainVerification('dom/1&x');

    expect(http.del).toHaveBeenCalledWith('/api/v1/verifications/domain/dom%2F1%26x');
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

describe('Hitl resource', () => {
  it('create sends POST with body', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'hitl_123', status: 'pending' });
    const h = new Hitl(http);

    await h.create({
      name: 'Production Approvals',
      channels: [{ type: 'telegram', config: { chat_id: '12345' } }],
      timeout_seconds: 3600,
    });

    expect(http.post).toHaveBeenCalledWith('/api/v1/hitl', {
      name: 'Production Approvals',
      channels: [{ type: 'telegram', config: { chat_id: '12345' } }],
      timeout_seconds: 3600,
    });
  });

  it('create omits optional params when not provided', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'hitl_123' });
    const h = new Hitl(http);

    await h.create({
      name: 'Minimal',
      channels: [{ type: 'whatsapp', config: { phone_number: '+12345678901' } }],
    });

    const body = vi.mocked(http.post).mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('timeout_seconds');
    expect(body).not.toHaveProperty('profile_id');
  });

  it('list sends GET with query params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [], pagination: {} });
    const h = new Hitl(http);

    await h.list({ status: 'active', limit: 10 });

    expect(http.get).toHaveBeenCalledWith('/api/v1/hitl', { status: 'active', limit: 10 });
  });

  it('list sends GET without params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [], pagination: {} });
    const h = new Hitl(http);

    await h.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/hitl', undefined);
  });

  it('retrieve sends GET with ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'hitl_123' });
    const h = new Hitl(http);

    await h.retrieve('hitl_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/hitl/hitl_123');
  });

  it('retrieve encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const h = new Hitl(http);

    await h.retrieve('hitl/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/hitl/hitl%2Fspecial%26id');
  });

  it('update sends PATCH with body', async () => {
    const http = mockHttp();
    vi.mocked(http.request).mockResolvedValue({ id: 'hitl_123' });
    const h = new Hitl(http);

    await h.update('hitl_123', { name: 'Renamed', timeout_seconds: 7200 });

    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/v1/hitl/hitl_123', {
      body: { name: 'Renamed', timeout_seconds: 7200 },
    });
  });

  it('archive sends DELETE', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ id: 'hitl_123', status: 'archived' });
    const h = new Hitl(http);

    await h.archive('hitl_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/hitl/hitl_123');
  });

  it('finalize sends POST without body', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'hitl_123', status: 'active' });
    const h = new Hitl(http);

    await h.finalize('hitl_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/hitl/hitl_123/finalize');
  });

  it('requestAuthorization sends POST to /authorize', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ hitl_id: 'hitl_123', authorizations: [] });
    const h = new Hitl(http);

    await h.requestAuthorization('hitl_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/hitl/hitl_123/authorize');
  });

  it('requestAuthorization encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({});
    const h = new Hitl(http);

    await h.requestAuthorization('hitl/special&id');

    expect(http.post).toHaveBeenCalledWith('/api/v1/hitl/hitl%2Fspecial%26id/authorize');
  });
});

describe('HitlChatIdDiscovery resource', () => {
  it('create sends POST without body', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ token: 'tok', deep_link: 'https://t.me/x' });
    const d = new HitlChatIdDiscovery(http);

    await d.create();

    expect(http.post).toHaveBeenCalledWith('/api/v1/hitl/chat-id-discovery');
  });
});

describe('Confirmations resource', () => {
  it('approvalLink sends POST with ID', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ approval_url: 'https://api.example.com/resolve?t=x' });
    const c = new Confirmations(http);

    await c.approvalLink('conf_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/confirmations/conf_123/approval-link');
  });

  it('approvalLink encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({});
    const c = new Confirmations(http);

    await c.approvalLink('conf/special&id');

    expect(http.post).toHaveBeenCalledWith('/api/v1/confirmations/conf%2Fspecial%26id/approval-link');
  });
});

describe('VerificationRequests proofs', () => {
  it('getProofs sends GET with ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ proofs: [] });
    const vr = new VerificationRequests(http);

    await vr.getProofs('vr_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/verification-requests/vr_123/proofs');
  });

  it('getProofs encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ proofs: [] });
    const vr = new VerificationRequests(http);

    await vr.getProofs('vr/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/verification-requests/vr%2Fspecial%26id/proofs');
  });
});

describe('Templates resource', () => {
  it('list sends GET to templates endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ custom_templates: [], available_channels: [] });
    const t = new Templates(http);

    await t.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/templates');
  });

  it('getDefaults sends GET to defaults endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ defaults: {} });
    const t = new Templates(http);

    await t.getDefaults();

    expect(http.get).toHaveBeenCalledWith('/api/v1/templates/defaults');
  });

  it('retrieve sends GET with channel and message type', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ is_custom: false, template: {} });
    const t = new Templates(http);

    await t.retrieve('telegram', 'confirmation_request');

    expect(http.get).toHaveBeenCalledWith('/api/v1/templates/telegram/confirmation_request');
  });

  it('upsert sends PUT with template content body', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ success: true, template: {} });
    const t = new Templates(http);

    await t.upsert('whatsapp', 'verification_request', {
      body: 'Your code is {{code}}',
      button_text: 'Verify',
    });

    expect(http.put).toHaveBeenCalledWith('/api/v1/templates/whatsapp/verification_request', {
      body: 'Your code is {{code}}',
      button_text: 'Verify',
    });
  });

  it('delete sends DELETE to template endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true, message: 'Template reset to default' });
    const t = new Templates(http);

    await t.delete('email', 'login_request');

    expect(http.del).toHaveBeenCalledWith('/api/v1/templates/email/login_request');
  });

  it('preview sends POST with channel, message_type, and content', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ preview: { body: 'x' }, validation_errors: [], is_valid: true });
    const t = new Templates(http);

    await t.preview({ channel: 'telegram', message_type: 'confirmation_request', body: 'Hi {{business_name}}' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/templates/preview', {
      channel: 'telegram',
      message_type: 'confirmation_request',
      body: 'Hi {{business_name}}',
    });
  });

  it('render sends POST with variables', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ rendered: { body: 'Code: 123456' } });
    const t = new Templates(http);

    await t.render({ channel: 'sms', message_type: 'verification_request', variables: { code: '123456' } });

    expect(http.post).toHaveBeenCalledWith('/api/v1/templates/render', {
      channel: 'sms',
      message_type: 'verification_request',
      variables: { code: '123456' },
    });
  });
});

describe('Profiles resource', () => {
  it('list sends GET to me/profiles', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ profiles: [], count: 0, max_profiles: 1 });
    const p = new Profiles(http);

    await p.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/profiles');
  });

  it('create sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'pr_1' });
    const p = new Profiles(http);

    await p.create({ display_name: 'Acme', is_business: true });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/profiles', { display_name: 'Acme', is_business: true });
  });

  it('retrieve sends GET with encoded profile ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'pr_1' });
    const p = new Profiles(http);

    await p.retrieve('pr/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/profiles/pr%2Fspecial%26id');
  });

  it('update sends PATCH with body', async () => {
    const http = mockHttp();
    vi.mocked(http.request).mockResolvedValue({ id: 'pr_1' });
    const p = new Profiles(http);

    await p.update('pr_1', { bio: 'New bio' });

    expect(http.request).toHaveBeenCalledWith('PATCH', '/api/v1/me/profiles/pr_1', { body: { bio: 'New bio' } });
  });

  it('delete sends DELETE to profile endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true, message: 'Profile deleted' });
    const p = new Profiles(http);

    await p.delete('pr_1');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/profiles/pr_1');
  });

  it('setPrimary sends POST to primary endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'pr_1', is_primary: true });
    const p = new Profiles(http);

    await p.setPrimary('pr_1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/profiles/pr_1/primary');
  });

  it('listTemplates sends GET to templates endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ profile_id: 'pr_1', templates: [] });
    const p = new Profiles(http);

    await p.listTemplates('pr_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/profiles/pr_1/templates');
  });

  it('updateTemplate sends PUT with channel/type and body', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ channel: 'telegram', message_type: 'confirmation_request', is_custom: true });
    const p = new Profiles(http);

    await p.updateTemplate('pr_1', 'telegram', 'confirmation_request', { body: 'Approve {{business_name}}?' });

    expect(http.put).toHaveBeenCalledWith(
      '/api/v1/me/profiles/pr_1/templates/telegram/confirmation_request',
      { body: 'Approve {{business_name}}?' },
    );
  });

  it('deleteTemplate sends DELETE with channel/type', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ channel: 'email', message_type: 'login_request', is_custom: false });
    const p = new Profiles(http);

    await p.deleteTemplate('pr_1', 'email', 'login_request');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/profiles/pr_1/templates/email/login_request');
  });

  it('previewTemplate sends POST with content', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ preview: { body: 'x' }, variables_used: [] });
    const p = new Profiles(http);

    await p.previewTemplate('pr_1', { channel: 'sms', message_type: '2fa_request', body: 'Code: {{code}}' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/profiles/pr_1/templates/preview', {
      channel: 'sms',
      message_type: '2fa_request',
      body: 'Code: {{code}}',
    });
  });
});

describe('PublicProfiles resource', () => {
  it('getById sends GET to public profile endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ profile_id: 'pr_1', proofs: [], links: [] });
    const p = new PublicProfiles(http);

    await p.getById('pr_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/p/pr_1');
  });

  it('getById encodes special characters in ID', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const p = new PublicProfiles(http);

    await p.getById('pr/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/p/pr%2Fspecial%26id');
  });

  it('getAvatar sends GET to avatar endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: new Uint8Array([1]), content_type: 'image/png' });
    const p = new PublicProfiles(http);

    const result = await p.getAvatar('pr_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/p/pr_1/avatar');
    expect(result.content_type).toBe('image/png');
  });

  it('getByUsername sends GET to username endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ profile_id: 'pr_1', username: 'acme' });
    const p = new PublicProfiles(http);

    await p.getByUsername('acme');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/u/acme');
  });

  it('getBadge sends GET to the badge descriptor endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ username: 'team_mgmt', state: 'no_public_record' });
    const p = new PublicProfiles(http);

    const result = await p.getBadge('team_mgmt');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/badge/team_mgmt');
    // `state` is the field a caller branches on — a username with no public record answers 200,
    // never a 404, so treating a missing badge as an error would be wrong.
    expect(result.state).toBe('no_public_record');
  });

  it('getBadge escapes the username in the path', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ username: 'a b' });
    const p = new PublicProfiles(http);

    await p.getBadge('a b');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/badge/a%20b');
  });

  it('checkUsername sends GET to check-username endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ available: true });
    const p = new PublicProfiles(http);

    const result = await p.checkUsername('acme');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/check-username/acme');
    expect(result.available).toBe(true);
  });
});

describe('Me resource (dashboard/agent data surface)', () => {
  it('summary sends GET with environment query', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ as_of: '2026-06-22', active_api_keys: 1 });
    const m = new Me(http);

    await m.summary({ environment: 'test' });

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/summary', { environment: 'test' });
  });

  it('summary sends GET with no params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ as_of: '2026-06-22' });
    const m = new Me(http);

    await m.summary();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/summary', undefined);
  });

  it('search sends GET with query params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: {}, total: 0 });
    const m = new Me(http);

    await m.search({ q: 'acme', type: 'verifications', limit: 5 });

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/search', { q: 'acme', type: 'verifications', limit: 5 });
  });

  it('apiKeySelf sends GET to singular api-key endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'key_1', key_prefix: 'pk_live_' });
    const m = new Me(http);

    await m.apiKeySelf();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/api-key');
  });

  it('apiKeySelf surfaces the sub-account binding (profile_id)', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'key_1', key_prefix: 'pk_live_', profile_id: null });
    const m = new Me(http);

    const meta = await m.apiKeySelf();

    expect(meta.profile_id).toBeNull();
  });

  it('apiKeyUsage sends GET with encoded id and environment', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ api_key: {}, verifications: {} });
    const m = new Me(http);

    await m.apiKeyUsage('key_1', { environment: 'production' });

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/api-keys/key_1/usage', { environment: 'production' });
  });

  it('apiKeyUsage encodes special characters in id', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const m = new Me(http);

    await m.apiKeyUsage('key/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/api-keys/key%2Fspecial%26id/usage', undefined);
  });
});
