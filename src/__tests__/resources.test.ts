import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '../http.js';
import { Verifications } from '../resources/verifications.js';
import { Sessions } from '../resources/sessions.js';
import { VerificationRequests } from '../resources/verification-requests.js';
import { WebhookDeliveries } from '../resources/webhook-deliveries.js';
import { Templates } from '../resources/templates.js';
import { Profiles } from '../resources/profiles.js';
import { Projects } from '../resources/projects.js';
import { Billing } from '../resources/billing.js';
import { Phones } from '../resources/phones.js';
import { Emails } from '../resources/emails.js';
import { Assets } from '../resources/assets.js';
import { Auth } from '../resources/auth.js';
import { Settings } from '../resources/settings.js';
import { ApiKeys } from '../resources/api-keys.js';
import { Account } from '../resources/account.js';
import { TwoFA } from '../resources/two-fa.js';
import { DnsCredentials } from '../resources/dns-credentials.js';
import { Domains } from '../resources/domains.js';
import { UserRequests } from '../resources/user-requests.js';
import { UserDomainVerify } from '../resources/user-domain-verify.js';
import { PublicProfiles } from '../resources/public-profiles.js';

function mockHttp() {
  return {
    baseUrl: 'https://api.example.com',
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
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

describe('Templates resource', () => {
  it('list sends GET to templates endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ custom_templates: [] });
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

  it('retrieve sends GET with channel and messageType', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ is_custom: false, template: {} });
    const t = new Templates(http);

    await t.retrieve('email', 'verification_request');

    expect(http.get).toHaveBeenCalledWith('/api/v1/templates/email/verification_request');
  });

  it('retrieve encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const t = new Templates(http);

    await t.retrieve('sms/special', '2fa&request');

    expect(http.get).toHaveBeenCalledWith('/api/v1/templates/sms%2Fspecial/2fa%26request');
  });

  it('upsert sends PUT with body', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ success: true, template: {} });
    const t = new Templates(http);

    await t.upsert('telegram', 'login_request', { body: 'Hello {{code}}' });

    expect(http.put).toHaveBeenCalledWith(
      '/api/v1/templates/telegram/login_request',
      { body: 'Hello {{code}}' },
    );
  });

  it('delete sends DELETE with channel and messageType', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const t = new Templates(http);

    await t.delete('whatsapp', 'verification_success');

    expect(http.del).toHaveBeenCalledWith('/api/v1/templates/whatsapp/verification_success');
  });

  it('preview sends POST with template content', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ preview: {}, is_valid: true });
    const t = new Templates(http);

    await t.preview({ channel: 'email', message_type: 'verification_request', body: 'Test {{code}}' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/templates/preview', {
      channel: 'email',
      message_type: 'verification_request',
      body: 'Test {{code}}',
    });
  });

  it('render sends POST with variables', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ rendered: {} });
    const t = new Templates(http);

    await t.render({ channel: 'sms', message_type: '2fa_request', variables: { code: '123456' } });

    expect(http.post).toHaveBeenCalledWith('/api/v1/templates/render', {
      channel: 'sms',
      message_type: '2fa_request',
      variables: { code: '123456' },
    });
  });
});

describe('Profiles resource', () => {
  it('list sends GET to profiles endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ profiles: [] });
    const p = new Profiles(http);

    await p.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/profiles');
  });

  it('create sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'prof_123' });
    const p = new Profiles(http);

    await p.create({ display_name: 'Test', is_public: true });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/profiles', {
      display_name: 'Test',
      is_public: true,
    });
  });

  it('retrieve sends GET with profileId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'prof_123' });
    const p = new Profiles(http);

    await p.retrieve('prof_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/profiles/prof_123');
  });

  it('retrieve encodes special characters in profileId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const p = new Profiles(http);

    await p.retrieve('prof/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/profiles/prof%2Fspecial%26id');
  });

  it('update sends PATCH with params', async () => {
    const http = mockHttp();
    vi.mocked(http.patch).mockResolvedValue({ id: 'prof_123' });
    const p = new Profiles(http);

    await p.update('prof_123', { display_name: 'Updated' });

    expect(http.patch).toHaveBeenCalledWith('/api/v1/me/profiles/prof_123', {
      display_name: 'Updated',
    });
  });

  it('delete sends DELETE with profileId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const p = new Profiles(http);

    await p.delete('prof_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/profiles/prof_123');
  });

  it('setPrimary sends POST to primary endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const p = new Profiles(http);

    await p.setPrimary('prof_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/profiles/prof_123/primary');
  });
});

describe('Projects resource', () => {
  it('list sends GET to projects endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const p = new Projects(http);

    await p.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/projects');
  });

  it('create sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'proj_123' });
    const p = new Projects(http);

    await p.create({ name: 'My Project' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/projects', { name: 'My Project' });
  });

  it('retrieve sends GET with projectId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'proj_123' });
    const p = new Projects(http);

    await p.retrieve('proj_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/projects/proj_123');
  });

  it('retrieve encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const p = new Projects(http);

    await p.retrieve('proj/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/projects/proj%2Fspecial%26id');
  });

  it('update sends PUT with params', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ id: 'proj_123' });
    const p = new Projects(http);

    await p.update('proj_123', { name: 'Updated' });

    expect(http.put).toHaveBeenCalledWith('/api/v1/me/projects/proj_123', { name: 'Updated' });
  });

  it('delete sends DELETE with projectId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const p = new Projects(http);

    await p.delete('proj_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/projects/proj_123');
  });

  it('listTemplates sends GET to templates endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ templates: [] });
    const p = new Projects(http);

    await p.listTemplates('proj_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/projects/proj_123/templates');
  });

  it('updateTemplate sends PUT with compound URL', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ is_custom: true });
    const p = new Projects(http);

    await p.updateTemplate('proj_123', 'email', 'verification_request', { body: 'Hello {{code}}' });

    expect(http.put).toHaveBeenCalledWith(
      '/api/v1/me/projects/proj_123/templates/email/verification_request',
      { body: 'Hello {{code}}' },
    );
  });

  it('deleteTemplate sends DELETE with compound URL', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ is_custom: false });
    const p = new Projects(http);

    await p.deleteTemplate('proj_123', 'sms', '2fa_request');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/projects/proj_123/templates/sms/2fa_request');
  });

  it('previewTemplate sends POST to preview endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ preview: {} });
    const p = new Projects(http);

    await p.previewTemplate('proj_123', {
      channel: 'email',
      message_type: 'verification_request',
      body: 'Test {{code}}',
    });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/projects/proj_123/templates/preview', {
      channel: 'email',
      message_type: 'verification_request',
      body: 'Test {{code}}',
    });
  });

  it('updateTemplate encodes all URL segments', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({});
    const p = new Projects(http);

    await p.updateTemplate('proj/id', 'ch/an', 'ty/pe', { body: 'test' });

    expect(http.put).toHaveBeenCalledWith(
      '/api/v1/me/projects/proj%2Fid/templates/ch%2Fan/ty%2Fpe',
      { body: 'test' },
    );
  });
});

describe('Billing resource', () => {
  it('subscription sends GET to correct endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ plan: 'free' });
    const b = new Billing(http);

    await b.subscription();

    expect(http.get).toHaveBeenCalledWith('/api/v1/billing/subscription');
  });

  it('checkout sends POST with plan params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ checkout_url: 'https://checkout.stripe.com/...' });
    const b = new Billing(http);

    await b.checkout({ plan: 'pro', success_url: 'https://proof.holdings/success', cancel_url: 'https://proof.holdings/cancel' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/billing/checkout', {
      plan: 'pro',
      success_url: 'https://proof.holdings/success',
      cancel_url: 'https://proof.holdings/cancel',
    });
  });

  it('portal sends POST with return_url', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ portal_url: 'https://billing.stripe.com/...' });
    const b = new Billing(http);

    await b.portal({ return_url: 'https://proof.holdings/billing' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/billing/portal', {
      return_url: 'https://proof.holdings/billing',
    });
  });
});

describe('Phones resource', () => {
  it('list sends GET to phones endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const p = new Phones(http);

    await p.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/phones');
  });

  it('remove sends DELETE with phoneId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const p = new Phones(http);

    await p.remove('phone_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/phones/phone_123');
  });

  it('setPrimary sends PUT to primary endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ success: true });
    const p = new Phones(http);

    await p.setPrimary('phone_123');

    expect(http.put).toHaveBeenCalledWith('/api/v1/me/phones/phone_123/primary');
  });

  it('startAdd sends POST with channel', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ session_id: 'sess_123' });
    const p = new Phones(http);

    await p.startAdd({ channel: 'telegram' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/phones/add', { channel: 'telegram' });
  });

  it('getAddStatus sends GET with sessionId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'pending' });
    const p = new Phones(http);

    await p.getAddStatus('sess_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/phones/add/sess_123');
  });
});

describe('Emails resource', () => {
  it('list sends GET to emails endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const e = new Emails(http);

    await e.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/emails');
  });

  it('remove sends DELETE with emailId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const e = new Emails(http);

    await e.remove('email_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/emails/email_123');
  });

  it('setPrimary sends PUT to primary endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ success: true });
    const e = new Emails(http);

    await e.setPrimary('email_123');

    expect(http.put).toHaveBeenCalledWith('/api/v1/me/emails/email_123/primary');
  });

  it('startAdd sends POST with email', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ session_id: 'sess_123' });
    const e = new Emails(http);

    await e.startAdd({ email: 'user@example.com' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/emails/add', { email: 'user@example.com' });
  });

  it('getAddStatus sends GET with sessionId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'pending' });
    const e = new Emails(http);

    await e.getAddStatus('sess_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/emails/add/sess_123');
  });

  it('verifyOtp sends POST with code', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ status: 'verified' });
    const e = new Emails(http);

    await e.verifyOtp('sess_123', { code: '123456' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/emails/add/sess_123/verify', { code: '123456' });
  });

  it('resendOtp sends POST to resend endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const e = new Emails(http);

    await e.resendOtp('sess_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/emails/add/sess_123/resend');
  });
});

describe('Assets resource', () => {
  it('list sends GET to assets endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const a = new Assets(http);

    await a.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/assets', undefined);
  });

  it('get sends GET with assetId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'asset_123' });
    const a = new Assets(http);

    await a.get('asset_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/assets/asset_123');
  });

  it('revoke sends DELETE with assetId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const a = new Assets(http);

    await a.revoke('asset_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/assets/asset_123');
  });
});

describe('Auth resource', () => {
  it('getMe sends GET to auth/me endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'user_123', email: 'test@example.com' });
    const a = new Auth(http);

    await a.getMe();

    expect(http.get).toHaveBeenCalledWith('/api/v1/auth/me');
  });

  it('listSessions sends GET to auth/sessions', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ sessions: [] });
    const a = new Auth(http);

    await a.listSessions();

    expect(http.get).toHaveBeenCalledWith('/api/v1/auth/sessions');
  });

  it('revokeSession sends DELETE with sessionId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const a = new Auth(http);

    await a.revokeSession('sess_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/auth/sessions/sess_123');
  });

  it('revokeSession encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const a = new Auth(http);

    await a.revokeSession('sess/special&id');

    expect(http.del).toHaveBeenCalledWith('/api/v1/auth/sessions/sess%2Fspecial%26id');
  });
});

describe('Settings resource', () => {
  it('get sends GET to settings endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ branding: {} });
    const s = new Settings(http);

    await s.get();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/settings');
  });

  it('update sends PATCH with params', async () => {
    const http = mockHttp();
    vi.mocked(http.patch).mockResolvedValue({ branding: { business_name: 'Acme' } });
    const s = new Settings(http);

    await s.update({ branding: { business_name: 'Acme' } });

    expect(http.patch).toHaveBeenCalledWith('/api/v1/me/settings', {
      branding: { business_name: 'Acme' },
    });
  });

  it('getUsage sends GET to usage endpoint without params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ usage: [] });
    const s = new Settings(http);

    await s.getUsage();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/usage', undefined);
  });

  it('getUsage sends GET with query params', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ usage: [] });
    const s = new Settings(http);

    await s.getUsage({ period: '2026-02', months: 3 });

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/usage', { period: '2026-02', months: '3' });
  });

  it('export sends GET to export endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: {} });
    const s = new Settings(http);

    await s.export();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/export');
  });
});

describe('ApiKeys resource', () => {
  it('list sends GET to api-keys endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ api_keys: [] });
    const ak = new ApiKeys(http);

    await ak.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/api-keys');
  });

  it('create sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'key_123', secret: 'pk_test_...' });
    const ak = new ApiKeys(http);

    await ak.create({ name: 'My Key', environment: 'test' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/api-keys', {
      name: 'My Key',
      environment: 'test',
    });
  });

  it('create sends POST with empty body when no params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'key_123' });
    const ak = new ApiKeys(http);

    await ak.create();

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/api-keys', {});
  });

  it('revoke sends DELETE with keyId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const ak = new ApiKeys(http);

    await ak.revoke('key_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/api-keys/key_123');
  });

  it('revoke encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const ak = new ApiKeys(http);

    await ak.revoke('key/special&id');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/api-keys/key%2Fspecial%26id');
  });

  it('regenerate sends POST to regenerate endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'key_123', secret: 'pk_test_new...' });
    const ak = new ApiKeys(http);

    await ak.regenerate('key_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/api-keys/key_123/regenerate');
  });
});

describe('Account resource', () => {
  it('initiateDeletion sends POST to delete endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ session_id: 'sess_123' });
    const a = new Account(http);

    await a.initiateDeletion();

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/account/delete', {});
  });

  it('deletionStatus sends GET with sessionId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'pending' });
    const a = new Account(http);

    await a.deletionStatus('sess_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/account/delete/sess_123');
  });

  it('deletionStatus encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const a = new Account(http);

    await a.deletionStatus('sess/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/account/delete/sess%2Fspecial%26id');
  });

  it('verifyDeletion sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const a = new Account(http);

    await a.verifyDeletion('sess_123', { code: '123456' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/account/delete/sess_123/verify', { code: '123456' });
  });

  it('verifyDeletionMagicLink sends POST with token', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const a = new Account(http);

    await a.verifyDeletionMagicLink('tok_abc');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/account/delete/magic/tok_abc');
  });

  it('delete sends DELETE with body via request', async () => {
    const http = mockHttp();
    vi.mocked(http.request).mockResolvedValue({ success: true });
    const a = new Account(http);

    await a.delete({ session_id: 'sess_123' });

    expect(http.request).toHaveBeenCalledWith('DELETE', '/api/v1/me/account', { body: { session_id: 'sess_123' } });
  });
});

describe('TwoFA resource', () => {
  it('start sends POST with action_type and channel', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ session_id: 'sess_123' });
    const t = new TwoFA(http);

    await t.start({ action_type: 'api_key_view', channel: 'email' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/2fa/start', { action_type: 'api_key_view', channel: 'email' });
  });

  it('getStatus sends GET with sessionId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'pending' });
    const t = new TwoFA(http);

    await t.getStatus('sess_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/2fa/sess_123');
  });

  it('getStatus encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const t = new TwoFA(http);

    await t.getStatus('sess/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/2fa/sess%2Fspecial%26id');
  });

  it('verify sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const t = new TwoFA(http);

    await t.verify('sess_123', { code: '123456' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/2fa/sess_123/verify', { code: '123456' });
  });

  it('verifyMagicLink sends POST with token', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const t = new TwoFA(http);

    await t.verifyMagicLink('tok_abc');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/2fa/magic/tok_abc');
  });
});

describe('DnsCredentials resource', () => {
  it('list sends GET to dns-credentials endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const d = new DnsCredentials(http);

    await d.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/dns-credentials');
  });

  it('create sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'cred_123' });
    const d = new DnsCredentials(http);

    await d.create({ provider: 'cloudflare', credentials: { api_token: 'tok_123' } });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/dns-credentials', { provider: 'cloudflare', credentials: { api_token: 'tok_123' } });
  });

  it('delete sends DELETE with credentialId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const d = new DnsCredentials(http);

    await d.delete('cred_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/dns-credentials/cred_123');
  });

  it('delete encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const d = new DnsCredentials(http);

    await d.delete('cred/special&id');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/dns-credentials/cred%2Fspecial%26id');
  });
});

describe('Domains resource', () => {
  it('list sends GET to domains endpoint', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ data: [] });
    const d = new Domains(http);

    await d.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/domains');
  });

  it('add sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'dom_123' });
    const d = new Domains(http);

    await d.add({ domain: 'example.com', verification_method: 'auto_dns' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains', { domain: 'example.com', verification_method: 'auto_dns' });
  });

  it('get sends GET with domainId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'dom_123' });
    const d = new Domains(http);

    await d.get('dom_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/domains/dom_123');
  });

  it('get encodes special characters', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({});
    const d = new Domains(http);

    await d.get('dom/special&id');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/domains/dom%2Fspecial%26id');
  });

  it('delete sends DELETE with domainId', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.delete('dom_123');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/domains/dom_123');
  });

  it('oauthUrl sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ oauth_url: 'https://example.com' });
    const d = new Domains(http);

    await d.oauthUrl('dom_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/oauth-url');
  });

  it('verify sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.verify('dom_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/verify');
  });

  it('connectCloudflare sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.connectCloudflare('dom_123', { api_token: 'cf_tok' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/connect/cloudflare', { api_token: 'cf_tok' });
  });

  it('connectGoDaddy sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.connectGoDaddy('dom_123', { api_key: 'gd_key', api_secret: 'gd_secret' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/connect/godaddy', { api_key: 'gd_key', api_secret: 'gd_secret' });
  });

  it('connectProvider sends POST with provider and params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.connectProvider('dom_123', 'namecheap', { credentials: { api_key: 'nc_key' } });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/connect/namecheap', { credentials: { api_key: 'nc_key' } });
  });

  it('connectProvider encodes provider name', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.connectProvider('dom_123', 'my/provider', { credentials: { key: 'val' } });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/connect/my%2Fprovider', { credentials: { key: 'val' } });
  });

  it('addProvider sends POST with provider and params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.addProvider('dom_123', 'route53', { credentials: { access_key: 'ak' } });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/add-provider/route53', { credentials: { access_key: 'ak' } });
  });

  it('getProviders sends GET to dns-providers', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ providers: [] });
    const d = new Domains(http);

    await d.getProviders();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/dns-providers');
  });

  it('verifyWithCredentials sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.verifyWithCredentials('dom_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/verify-with-credentials');
  });

  it('checkCredentials sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ has_access: true });
    const d = new Domains(http);

    await d.checkCredentials('dom_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/check-credentials');
  });

  it('startEmailVerification sends POST with optional params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.startEmailVerification('dom_123', { email_prefix: 'admin' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/verify-email', { email_prefix: 'admin' });
  });

  it('startEmailVerification sends empty body when no params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.startEmailVerification('dom_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/verify-email', {});
  });

  it('confirmEmailCode sends POST with code', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.confirmEmailCode('dom_123', { code: '123456' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/verify-email/confirm', { code: '123456' });
  });

  it('resendEmail sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.resendEmail('dom_123');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/verify-email/resend', {});
  });

  it('emailSetup sends POST with optional params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new Domains(http);

    await d.emailSetup('dom_123', { from_email: 'noreply@example.com' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/email-setup', { from_email: 'noreply@example.com' });
  });

  it('emailStatus sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'active' });
    const d = new Domains(http);

    await d.emailStatus('dom_123');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/domains/dom_123/email-status');
  });
});

describe('UserRequests resource', () => {
  it('list sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ requests: [] });
    const r = new UserRequests(http);

    await r.list();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/verification-requests');
  });

  it('listIncoming sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ requests: [] });
    const r = new UserRequests(http);

    await r.listIncoming();

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/verification-requests/incoming');
  });

  it('create sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'req_1' });
    const r = new UserRequests(http);

    await r.create({ type: 'phone' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verification-requests', { type: 'phone' });
  });

  it('claim sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const r = new UserRequests(http);

    await r.claim('req_1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verification-requests/req_1/claim');
  });

  it('cancel sends DELETE', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const r = new UserRequests(http);

    await r.cancel('req_1');

    expect(http.del).toHaveBeenCalledWith('/api/v1/me/verification-requests/req_1');
  });

  it('extend sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const r = new UserRequests(http);

    await r.extend('req_1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verification-requests/req_1/extend');
  });

  it('shareEmail sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const r = new UserRequests(http);

    await r.shareEmail('req_1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verification-requests/req_1/share-email');
  });

  it('encodes special characters in requestId', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const r = new UserRequests(http);

    await r.claim('req/special');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verification-requests/req%2Fspecial/claim');
  });
});

describe('UserDomainVerify resource', () => {
  it('start sends POST with params', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ sessionId: 'sess_1' });
    const d = new UserDomainVerify(http);

    await d.start({ domain: 'example.com' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verify/domain', { domain: 'example.com' });
  });

  it('status sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'pending' });
    const d = new UserDomainVerify(http);

    await d.status('sess_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/verify/domain/sess_1');
  });

  it('check sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const d = new UserDomainVerify(http);

    await d.check('sess_1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/me/verify/domain/sess_1/check');
  });

  it('encodes special characters in sessionId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ status: 'pending' });
    const d = new UserDomainVerify(http);

    await d.status('sess/special');

    expect(http.get).toHaveBeenCalledWith('/api/v1/me/verify/domain/sess%2Fspecial');
  });
});

describe('PublicProfiles resource', () => {
  it('getById sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'prof_1' });
    const p = new PublicProfiles(http);

    await p.getById('prof_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/p/prof_1');
  });

  it('getAvatar sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ url: 'https://...' });
    const p = new PublicProfiles(http);

    await p.getAvatar('prof_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/p/prof_1/avatar');
  });

  it('getByUsername sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ username: 'alice' });
    const p = new PublicProfiles(http);

    await p.getByUsername('alice');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/u/alice');
  });

  it('checkUsername sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ available: true });
    const p = new PublicProfiles(http);

    await p.checkUsername('alice');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/check-username/alice');
  });

  it('listProfiles sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ profiles: [] });
    const p = new PublicProfiles(http);

    await p.listProfiles();

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/profiles');
  });

  it('createProfile sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ id: 'prof_2' });
    const p = new PublicProfiles(http);

    await p.createProfile({ name: 'Test' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/profiles/profiles', { name: 'Test' });
  });

  it('getProfile sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'prof_1' });
    const p = new PublicProfiles(http);

    await p.getProfile('prof_1');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/profiles/prof_1');
  });

  it('updateProfile sends PATCH', async () => {
    const http = mockHttp();
    vi.mocked(http.patch).mockResolvedValue({ id: 'prof_1' });
    const p = new PublicProfiles(http);

    await p.updateProfile('prof_1', { name: 'Updated' });

    expect(http.patch).toHaveBeenCalledWith('/api/v1/profiles/profiles/prof_1', { name: 'Updated' });
  });

  it('deleteProfile sends DELETE', async () => {
    const http = mockHttp();
    vi.mocked(http.del).mockResolvedValue({ success: true });
    const p = new PublicProfiles(http);

    await p.deleteProfile('prof_1');

    expect(http.del).toHaveBeenCalledWith('/api/v1/profiles/profiles/prof_1');
  });

  it('setPrimary sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const p = new PublicProfiles(http);

    await p.setPrimary('prof_1');

    expect(http.post).toHaveBeenCalledWith('/api/v1/profiles/profiles/prof_1/primary');
  });

  it('updateProfileProofs sends PUT', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ id: 'prof_1' });
    const p = new PublicProfiles(http);

    await p.updateProfileProofs('prof_1', { proofs: ['p_1'] });

    expect(http.put).toHaveBeenCalledWith('/api/v1/profiles/profiles/prof_1/proofs', { proofs: ['p_1'] });
  });

  it('getMyProfile sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'prof_1' });
    const p = new PublicProfiles(http);

    await p.getMyProfile();

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/me');
  });

  it('updateMyProfile sends PUT', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ id: 'prof_1' });
    const p = new PublicProfiles(http);

    await p.updateMyProfile({ bio: 'Hello' });

    expect(http.put).toHaveBeenCalledWith('/api/v1/profiles/me', { bio: 'Hello' });
  });

  it('claimUsername sends POST', async () => {
    const http = mockHttp();
    vi.mocked(http.post).mockResolvedValue({ success: true });
    const p = new PublicProfiles(http);

    await p.claimUsername({ username: 'alice' });

    expect(http.post).toHaveBeenCalledWith('/api/v1/profiles/me/username', { username: 'alice' });
  });

  it('getAvailableAssets sends GET', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ assets: [] });
    const p = new PublicProfiles(http);

    await p.getAvailableAssets();

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/me/assets');
  });

  it('updatePublicProofs sends PUT', async () => {
    const http = mockHttp();
    vi.mocked(http.put).mockResolvedValue({ success: true });
    const p = new PublicProfiles(http);

    await p.updatePublicProofs({ proofs: ['p_1'] });

    expect(http.put).toHaveBeenCalledWith('/api/v1/profiles/me/proofs', { proofs: ['p_1'] });
  });

  it('encodes special characters in profileId', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ id: 'prof/special' });
    const p = new PublicProfiles(http);

    await p.getById('prof/special');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/p/prof%2Fspecial');
  });

  it('encodes special characters in username', async () => {
    const http = mockHttp();
    vi.mocked(http.get).mockResolvedValue({ available: true });
    const p = new PublicProfiles(http);

    await p.checkUsername('user/special');

    expect(http.get).toHaveBeenCalledWith('/api/v1/profiles/check-username/user%2Fspecial');
  });
});
