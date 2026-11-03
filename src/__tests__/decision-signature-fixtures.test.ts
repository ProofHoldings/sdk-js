import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Proof } from '../client.js';
import type { Confirmation, DecisionSignatureOutcome } from '../resources/confirmations.js';

interface FixtureCase {
  name: string;
  confirmation: Confirmation;
  public_key: string;
  expected: DecisionSignatureOutcome;
}

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(here, '../../../shared/fixtures', 'decision_signature', 'cases.json');
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as { cases: FixtureCase[] };

// A network-free method: the client is never asked to send anything.
const proof = new Proof('pk_test_decision_signature', {
  fetch: () => {
    throw new Error('verifyDecisionSignature must not reach the network');
  },
});

describe('confirmations.verifyDecisionSignature — shared decision_signature cases', () => {
  it('reads every case', () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const outcome = proof.confirmations.verifyDecisionSignature(c.confirmation, c.public_key);
    expect(outcome).toBe(c.expected);
  });
});
