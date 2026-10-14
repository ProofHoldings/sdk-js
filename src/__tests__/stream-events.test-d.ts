import { describe, expectTypeOf, test } from 'vitest';
import type { Proof } from '../client.js';
import type { Verification } from '../types.js';
import type {
  Confirmation,
  ConfirmationStreamConnected,
  ConfirmationStreamUpdate,
} from '../resources/confirmations.js';
import type {
  VerificationStreamConnected,
  VerificationStreamUpdate,
} from '../resources/verifications.js';
import type {
  AuthSession,
  AuthSessionStreamConnected,
  AuthSessionStreamUpdate,
} from '../resources/auth-sessions.js';
import type {
  ChatIdDiscovery,
  ChatIdDiscoveryStreamConnected,
  ChatIdDiscoveryStreamUpdate,
} from '../resources/hitl-chat-id.js';
import type {
  VerificationRequestAssetStatus,
  VerificationRequestAssetStreamConnected,
  VerificationRequestAssetStreamUpdate,
} from '../resources/verification-requests.js';
import type {
  PhoneAddSession,
  PhoneAddSessionStreamConnected,
  PhoneAddSessionStreamUpdate,
  EmailAddSession,
  EmailAddSessionStreamConnected,
  EmailAddSessionStreamUpdate,
  TwoFASession,
  TwoFASessionStreamConnected,
  TwoFASessionStreamUpdate,
} from '../resources/me.js';

const client = null as unknown as Proof;

describe('stream() event types: a live frame is a signal, only poll/terminal carry the resource', () => {
  test('confirmations.stream', async () => {
    for await (const ev of client.confirmations.stream('c')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.response;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<ConfirmationStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<ConfirmationStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<Confirmation>();
    }
  });

  test('verifications.stream', async () => {
    for await (const ev of client.verifications.stream('v')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'status_changed' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.status;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<VerificationStreamConnected>();
      if (ev.event === 'status_changed') expectTypeOf(ev.data).toEqualTypeOf<VerificationStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<Verification>();
    }
  });

  test('authSessions.stream', async () => {
    for await (const ev of client.authSessions.stream('a')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.id;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<AuthSessionStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<AuthSessionStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<AuthSession>();
    }
  });

  test('hitlChatIdDiscovery.stream', async () => {
    for await (const ev of client.hitlChatIdDiscovery.stream('t')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.token;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<ChatIdDiscoveryStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<ChatIdDiscoveryStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<ChatIdDiscovery>();
    }
  });

  test('verificationRequests.streamAsset', async () => {
    for await (const ev of client.verificationRequests.streamAsset('r', 0)) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.verified_at;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<VerificationRequestAssetStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<VerificationRequestAssetStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<VerificationRequestAssetStatus>();
    }
  });

  test('me.streamPhoneAddSession', async () => {
    for await (const ev of client.me.streamPhoneAddSession('p')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.id;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<PhoneAddSessionStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<PhoneAddSessionStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<PhoneAddSession>();
    }
  });

  test('me.streamEmailAddSession', async () => {
    for await (const ev of client.me.streamEmailAddSession('e')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.id;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<EmailAddSessionStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<EmailAddSessionStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<EmailAddSession>();
    }
  });

  test('me.stream2FASession', async () => {
    for await (const ev of client.me.stream2FASession('f')) {
      expectTypeOf(ev.event).toEqualTypeOf<'connected' | 'update' | 'poll' | 'terminal'>();
      // @ts-expect-error
      void ev.data.id;
      if (ev.event === 'connected') expectTypeOf(ev.data).toEqualTypeOf<TwoFASessionStreamConnected>();
      if (ev.event === 'update') expectTypeOf(ev.data).toEqualTypeOf<TwoFASessionStreamUpdate>();
      if (ev.event === 'poll' || ev.event === 'terminal') expectTypeOf(ev.data).toEqualTypeOf<TwoFASession>();
    }
  });
});
