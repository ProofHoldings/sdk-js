import { describe, expectTypeOf, test } from 'vitest';
import type { CreateSessionParams, Session, SessionChannel, SessionSmsNumber } from '../types.js';

// POST /api/v1/sessions takes `telegram`, `whatsapp` or `sms`, and names its sub-account by `profile_id`.
describe('Sessions types', () => {
  test('SessionChannel is exactly what the API accepts', () => {
    expectTypeOf<SessionChannel>().toEqualTypeOf<'telegram' | 'whatsapp' | 'sms'>();
  });

  test('create takes the sub-account a session is for', () => {
    expectTypeOf<CreateSessionParams>().toHaveProperty('profile_id').toEqualTypeOf<string | undefined>();
  });

  test('an sms session carries the code, the message and our numbers', () => {
    expectTypeOf<Session>().toHaveProperty('sms_code').toEqualTypeOf<string | undefined>();
    expectTypeOf<Session>().toHaveProperty('sms_message').toEqualTypeOf<string | undefined>();
    expectTypeOf<Session>().toHaveProperty('qr_text').toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<Session['sms_dids']>>().toEqualTypeOf<{
      americas: SessionSmsNumber;
      europe?: SessionSmsNumber;
      israel?: SessionSmsNumber;
    }>();
    expectTypeOf<SessionSmsNumber>().toEqualTypeOf<{
      did: string;
      label: string;
      flag: string;
      qr_code?: string;
      qr_text?: string;
    }>();
  });

  test('a verified session\'s proof carries its confidence (sms: standard, or degraded after a spoof check)', () => {
    expectTypeOf<NonNullable<Session['proof']>>().toHaveProperty('confidence')
      .toEqualTypeOf<'high' | 'standard' | 'degraded' | undefined>();
  });
});
