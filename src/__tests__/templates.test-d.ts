import { describe, expectTypeOf, test } from 'vitest';
import type {
  TemplateListResponse,
  TemplatePreviewResponse,
  TemplateSendablePair,
  TemplateSendWarning,
  TemplateUpsertResponse,
} from '../types.js';

// `sendable` (list) and `warnings` (PUT and preview 200s) are new, so an API that predates them omits the
// fields: the types must not promise them (D10 on #529).
describe('Templates types', () => {
  test('a list response may lack sendable', () => {
    expectTypeOf<TemplateListResponse>().toHaveProperty('sendable')
      .toEqualTypeOf<TemplateSendablePair[] | undefined>();
    // the key itself may be missing, not only its value undefined
    expectTypeOf<{}>().toMatchTypeOf<Pick<TemplateListResponse, 'sendable'>>();
  });

  test('a save response may lack warnings', () => {
    expectTypeOf<TemplateUpsertResponse>().toHaveProperty('warnings')
      .toEqualTypeOf<TemplateSendWarning[] | undefined>();
    // the key itself may be missing, not only its value undefined
    expectTypeOf<{}>().toMatchTypeOf<Pick<TemplateUpsertResponse, 'warnings'>>();
  });

  test('a preview response may lack warnings', () => {
    expectTypeOf<TemplatePreviewResponse>().toHaveProperty('warnings')
      .toEqualTypeOf<TemplateSendWarning[] | undefined>();
    // the key itself may be missing, not only its value undefined
    expectTypeOf<{}>().toMatchTypeOf<Pick<TemplatePreviewResponse, 'warnings'>>();
  });
});
