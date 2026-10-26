// Live coverage for what 1.2.0 adds: SMS sessions and per-project templates.
//
// Runs only in live mode (PROOF_BASE_URL + PROOF_API_KEY_TEST), against staging in the staging
// deploy and production in the production deploy. Nothing here sends a message or writes a row:
// creating an SMS session only stores a code the person would text in, and the template calls read.

import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../src/index.js';
import { createClient, LIVE_MODE } from './helpers.js';

const describeLive = LIVE_MODE ? describe : describe.skip;

// A well-formed project id no account owns: naming it must be refused, which is what proves
// `profileId` reaches the server rather than being dropped on the way.
const UNOWNED_PROFILE_ID = '000000000000000000000000';

describeLive('SMS sessions (integration, 1.2.0)', () => {
  it('creates an sms session carrying the code, the message, the numbers and the deep link', async () => {
    const client = createClient();
    const session = await client.sessions.create({
      channel: 'sms',
      client_metadata: { test_harness: 'sdk-integration', sdk: 'javascript' },
    });

    expect(session.id).toBeTruthy();
    expect(session.channel).toBe('sms');
    expect(session.status).toBe('pending');
    expect(session.sms_code).toMatch(/^\S+$/);
    expect(session.sms_message).toContain(session.sms_code!);
    expect(session.sms_dids?.americas.did).toMatch(/^\+\d+$/);
    expect(session.deep_link).toBe(
      `sms:${session.sms_dids!.americas.did}?body=${encodeURIComponent(session.sms_message!)}`,
    );

    const fetched = await client.sessions.retrieve(session.id);
    expect(fetched.id).toBe(session.id);
    expect(fetched.status).toBe('pending');
  });
});

describeLive('Per-project templates (integration, 1.2.0)', () => {
  it("lists and reads the key's default project's templates", async () => {
    const client = createClient();
    const listed = await client.templates.list();
    expect(listed.profile_id).toMatch(/^[0-9a-f]{24}$/);
    expect(Array.isArray(listed.custom_templates)).toBe(true);
    expect(listed.available_channels).toContain('sms');

    const template = await client.templates.retrieve('sms', 'verification_request');
    expect(template.profile_id).toBe(listed.profile_id);
    expect(['project', 'default']).toContain(template.scope);
    expect(template.template.body).toEqual(expect.any(String));
  });

  it('lists and reads a named project, and the name reaches the server', async () => {
    const client = createClient();
    const projectId = (await client.templates.list()).profile_id as string;

    const listed = await client.templates.list({ profileId: projectId });
    expect(listed.profile_id).toBe(projectId);
    const template = await client.templates.retrieve('sms', 'verification_request', { profileId: projectId });
    expect(template.profile_id).toBe(projectId);

    const refused = await client.templates.list({ profileId: UNOWNED_PROFILE_ID }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ForbiddenError);
    expect(['profile_not_owned', 'profile_mismatch']).toContain((refused as ForbiddenError).code);
  });
});
