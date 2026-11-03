import { describe, expectTypeOf, test } from 'vitest';
import type { Verifications } from '../resources/verifications.js';
import type { SubmitChallengeResponse, Verification } from '../types.js';

// POST /api/v1/verifications/:id/submit answers a SubmitChallengeResponse. 1.2.0 typed it `Verification`,
// so 1.x keeps that half of the type (sdks/shared/NEXT_MAJOR.md); the major narrows it.
describe('Verifications.submit types', () => {
  type Submitted = Awaited<ReturnType<Verifications['submit']>>;

  test('submit returns the released Verification and the response the server sends', () => {
    expectTypeOf<Submitted>().toEqualTypeOf<Verification & SubmitChallengeResponse>();
  });

  test('a 1.2.0 caller still compiles: the result is a Verification', () => {
    expectTypeOf<Submitted>().toMatchTypeOf<Verification>();
    expectTypeOf<Submitted['type']>().toEqualTypeOf<Verification['type']>();
    expectTypeOf<Submitted['channel']>().toEqualTypeOf<Verification['channel']>();
    expectTypeOf<Submitted['created_at']>().toEqualTypeOf<string>();
  });

  test('the fields the server sends stay typed', () => {
    expectTypeOf<Submitted['attempts']>().toEqualTypeOf<number>();
    expectTypeOf<Submitted['max_attempts']>().toEqualTypeOf<number>();
    expectTypeOf<Submitted['attempts_remaining']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Submitted['message']>().toEqualTypeOf<string | undefined>();
  });
});
