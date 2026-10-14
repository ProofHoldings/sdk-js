/**
 * Offline verification follows the issuer's key-rotation rules (h-verifier-jwks-js-python).
 *
 * The shared cases in `sdks/shared/fixtures/jwks_rotation/rotation_cases.json` run here through the
 * PUBLIC surface — `new Proof(...)`, `proofs.verifyOffline`, `refreshJWKS`, `clearTombstones` —
 * with the SDK's own `fetch` routed to the case's documents. The same file drives
 * `delegation-verifier` and the other SDKs, so a rule read differently here fails here. Step
 * semantics: the README beside the file.
 *
 * Two fixture names map onto this SDK's own vocabulary, which predates them: `bad_signature` is
 * `invalid` (pinned further by its message, so an `iss` failure cannot pass for it) and
 * `jwks_unavailable` is `status_unavailable` — "could not check".
 *
 * The cases move both clocks together, so they cannot tell them apart; the clock-base tests below
 * set them apart on purpose.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { Proof } from '../client.js';
import { setJwksClockForTests, setJwksEventListenerForTests } from '../jwks/key-set-cache.js';
import type { OfflineVerificationResult } from '../types.js';

interface FixtureStep {
  at: number;
  jwks: string | null;
  status_list?: string;
  action?: 'refresh' | 'reload' | 'clear_tombstones';
  verify?: string;
  status_check?: boolean;
  expect: {
    result?: string;
    fetches: number;
    pull_hint_handle?: string;
    cache_age_seconds?: number;
    events?: string[];
    vanished_kids?: string[];
  };
}

interface FixtureCase {
  name: string;
  families: string[];
  requires?: string[];
  max_jwks_age_seconds?: number;
  steps: FixtureStep[];
}

interface Fixture {
  context: {
    t0: number;
    jwks_uri: string;
    issuer_origin: string;
    status_list_uri: string;
    default_max_jwks_age_seconds: number;
  };
  documents: Record<string, unknown>;
  tokens: Record<string, { jwt: string; family: string }>;
  status_lists: Record<string, { jwt: string }>;
  cases: FixtureCase[];
}

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(here, '../../../shared/fixtures/jwks_rotation/rotation_cases.json');
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as Fixture;
const { context } = fixture;

/** Token families `verifyOffline` checks; this SDK has no key-set persistence. */
const FAMILIES = new Set(['proof', 'delegation', 'status-list']);
const CAPABILITIES = new Set<string>();

const runnable = fixture.cases.filter(
  (testCase) =>
    testCase.families.every((family) => FAMILIES.has(family)) &&
    (testCase.requires ?? []).every((capability) => CAPABILITIES.has(capability)),
);

/** The fixture's name for an SDK answer. */
function outcomeOf(result: OfflineVerificationResult): string {
  if (result.valid) return 'valid';
  if (result.reason === 'invalid') return 'bad_signature';
  if (result.reason === 'status_unavailable') return 'jwks_unavailable';
  return result.reason ?? 'missing reason';
}

interface Harness {
  proof: Proof;
  setStep(step: Pick<FixtureStep, 'jwks' | 'status_list'>): void;
  jwksFetches(): number;
  resetFetches(): void;
}

/** A client whose fetch answers the issuer's two public documents from the fixture. */
function harness(maxJwksAgeMs?: number): Harness {
  let current: Pick<FixtureStep, 'jwks' | 'status_list'> = { jwks: null };
  let fetches = 0;
  const routedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    // The key set is a public document: no credential, no redirect, the branded User-Agent.
    expect(init?.redirect).toBe('error');
    const headers = new Headers(init?.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.get('user-agent')).toMatch(/^proof-sdk-js\//);
    if (url === context.jwks_uri) {
      fetches += 1;
      if (current.jwks === null) return new Response('unavailable', { status: 503 });
      return new Response(JSON.stringify(fixture.documents[current.jwks]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === context.status_list_uri) {
      if (!current.status_list) return new Response('not found', { status: 404 });
      return new Response(fixture.status_lists[current.status_list].jwt, { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof globalThis.fetch;

  const proof = new Proof('pk_test_fixture', {
    baseUrl: context.issuer_origin,
    fetch: routedFetch,
    ...(maxJwksAgeMs !== undefined ? { maxJwksAgeMs } : {}),
  });
  return {
    proof,
    setStep: (step) => {
      current = step;
    },
    jwksFetches: () => fetches,
    resetFetches: () => {
      fetches = 0;
    },
  };
}

function vanishedKids(proof: Proof): string[] {
  const keySet = (proof.proofs as unknown as { keySet: { diagnostics(): { vanishedKids: string[] } } }).keySet;
  return keySet.diagnostics().vanishedKids;
}

function setClocks(monotonicSeconds: number, wallSeconds: number): void {
  setJwksClockForTests({ monotonicMs: () => monotonicSeconds * 1000, wallMs: () => wallSeconds * 1000 });
}

afterEach(() => {
  setJwksClockForTests(null);
  setJwksEventListenerForTests(null);
});

describe('shared key-rotation fixtures (h-verifier-jwks-js-python SC-2)', () => {
  it('runs a meaningful share of the shared cases — a filter that skips everything must not pass', () => {
    expect(runnable.length).toBeGreaterThanOrEqual(30);
    expect(runnable.map((testCase) => testCase.name)).toEqual(
      expect.arrayContaining([
        'unknown_status_list_kid',
        'tombstone_proof_pull_hint',
        'clear_tombstones_lifts_applied_tombstone',
        'tolerant_mode',
        'max_jwks_age_refetch_failure_over_bound',
      ]),
    );
    expect(fixture.cases.filter((testCase) => !runnable.includes(testCase)).map((testCase) => testCase.name)).toEqual([
      'tombstone_persists_across_reload',
    ]);
  });

  it.each(runnable.map((testCase) => [testCase.name, testCase] as const))('%s', async (_name, testCase) => {
    const maxJwksAgeMs = (testCase.max_jwks_age_seconds ?? context.default_max_jwks_age_seconds) * 1000;
    const h = harness(maxJwksAgeMs);
    let events: string[] = [];
    setJwksEventListenerForTests((event) => events.push(event.type));

    for (const step of testCase.steps) {
      setClocks(step.at, step.at);
      h.setStep(step);
      h.resetFetches();
      events = [];
      const where = `${testCase.name} @ t0${step.at - context.t0 >= 0 ? '+' : ''}${step.at - context.t0}s`;

      if (step.action === 'refresh') h.proof.proofs.refreshJWKS();
      else if (step.action === 'clear_tombstones') h.proof.proofs.clearTombstones();
      else if (step.action !== undefined) throw new Error(`${where}: unsupported action ${step.action}`);

      if (step.verify) {
        const result = await h.proof.proofs.verifyOffline(fixture.tokens[step.verify].jwt, {
          checkRevocation: step.status_check === true,
        });
        expect(outcomeOf(result), `${where}: ${result.error ?? ''}`).toBe(step.expect.result);
        if (step.expect.result === 'bad_signature') {
          expect(result.error, where).toBe('signature verification failed');
        }
        if (step.expect.pull_hint_handle !== undefined) {
          expect(result.pull_hint, where).toEqual({
            issuer_origin: context.issuer_origin,
            handle: step.expect.pull_hint_handle,
          });
        }
        if (step.expect.cache_age_seconds !== undefined) {
          expect(result.cache_age_seconds, where).toBe(step.expect.cache_age_seconds);
        }
      }

      expect(h.jwksFetches(), `${where}: JWKS fetches`).toBe(step.expect.fetches);
      for (const expected of step.expect.events ?? []) expect(events, `${where}: events`).toContain(expected);
      if (step.expect.vanished_kids !== undefined) {
        expect(vanishedKids(h.proof), where).toEqual(step.expect.vanished_kids);
      }
    }
  });
});

describe('clock bases (h-verifier-jwks-js-python SC-8)', () => {
  const T0 = context.t0;
  const MIN = 60;
  const HOUR = 3600;

  it('reuses the key set on the MONOTONIC clock: a wall-clock jump does not refetch, monotonic time does', async () => {
    const h = harness();
    h.setStep({ jwks: 'registry_v1' });
    setClocks(T0, T0);
    expect((await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt)).valid).toBe(true);

    setClocks(T0 + MIN, T0 + 11 * MIN);
    expect((await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt)).valid).toBe(true);
    expect(h.jwksFetches()).toBe(1);

    setClocks(T0 + 11 * MIN, T0 + 11 * MIN);
    expect((await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt)).valid).toBe(true);
    expect(h.jwksFetches()).toBe(2);
  });

  it('measures staleness on the MONOTONIC clock: jwks_stale carries the monotonic age', async () => {
    const h = harness();
    h.setStep({ jwks: 'registry_v1' });
    setClocks(T0, T0);
    await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt);

    h.setStep({ jwks: null });
    setClocks(T0 + 25 * HOUR, T0 + HOUR);
    const result = await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt);
    expect(result.reason).toBe('jwks_stale');
    expect(result.cache_age_seconds).toBe(25 * HOUR);
  });

  it('spaces a tombstone confirmation on the MONOTONIC clock, not the wall clock', async () => {
    const confirmedThenTombstoned = async (secondFetch: { monotonic: number; wall: number }) => {
      const h = harness();
      h.setStep({ jwks: 'registry_v1' });
      setClocks(T0 - 11 * MIN, T0 - 11 * MIN);
      await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt);
      setClocks(T0, T0);
      await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt);
      h.setStep({ jwks: 'registry_tombstone_retired_delegation' });
      setClocks(T0 + 11 * MIN, T0 + 11 * MIN);
      await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt);
      setClocks(secondFetch.monotonic, secondFetch.wall);
      h.proof.proofs.refreshJWKS();
      return h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt);
    };

    expect((await confirmedThenTombstoned({ monotonic: T0 + 17 * MIN, wall: T0 + 12 * MIN })).reason).toBe('key_revoked');
    expect((await confirmedThenTombstoned({ monotonic: T0 + 12 * MIN, wall: T0 + 17 * MIN })).valid).toBe(true);
  });

  it("checks the token's exp against the WALL clock", async () => {
    const h = harness();
    h.setStep({ jwks: 'registry_v1' });
    setClocks(T0, T0 + 40 * 86_400);
    const result = await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt);
    expect(result.reason).toBe('expired');
  });
});

describe('one fetch in flight (D-JP1)', () => {
  /** The same token re-addressed to a kid no key set publishes; its signature never gets checked. */
  function withKid(token: string, kid: string): string {
    const [header, ...rest] = token.split('.');
    const decoded = JSON.parse(Buffer.from(header, 'base64url').toString('utf-8'));
    return [Buffer.from(JSON.stringify({ ...decoded, kid })).toString('base64url'), ...rest].join('.');
  }

  it('concurrent verifications on a cold cache share ONE key-set fetch', async () => {
    setClocks(context.t0, context.t0);
    const h = harness();
    h.setStep({ jwks: 'registry_v1' });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt)),
    );
    expect(results.every((result) => result.valid)).toBe(true);
    expect(h.jwksFetches()).toBe(1);
  });

  it('concurrent tokens naming unknown kids cost ONE refetch, then the cooldown holds', async () => {
    setClocks(context.t0, context.t0);
    const h = harness();
    h.setStep({ jwks: 'registry_v1' });
    await h.proof.proofs.verifyOffline(fixture.tokens.dlg_active.jwt);
    h.resetFetches();

    setClocks(context.t0 + 60, context.t0 + 60);
    const junk = Array.from({ length: 20 }, (_, i) => withKid(fixture.tokens.dlg_active.jwt, `junk-${i}`));
    const results = await Promise.all(junk.map((token) => h.proof.proofs.verifyOffline(token)));
    expect(results.every((result) => !result.valid)).toBe(true);
    expect(h.jwksFetches()).toBe(1);
  });
});

describe('client surface (h-verifier-jwks-js-python SC-1, SC-3, SC-4, SC-5)', () => {
  it('rejects a maxJwksAgeMs above 25 days, non-positive or fractional at construction', () => {
    const DAY_MS = 86_400_000;
    for (const bad of [25 * DAY_MS + 1, 0, -1, 1.5, Number.NaN, '1000' as unknown as number]) {
      expect(() => new Proof('pk_test_x', { maxJwksAgeMs: bad }), String(bad)).toThrow(/maxJwksAgeMs/);
    }
    expect(() => new Proof('pk_test_x', { maxJwksAgeMs: 25 * DAY_MS })).not.toThrow();
    expect(() => new Proof('pk_test_x')).not.toThrow();
  });

  it('exposes verified_at on a verified proof', async () => {
    setClocks(context.t0, context.t0);
    const h = harness();
    h.setStep({ jwks: 'registry_v1' });
    const token = fixture.tokens.prf_active.jwt;
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'));
    const result = await h.proof.proofs.verifyOffline(token);
    expect(result.valid).toBe(true);
    expect(result.payload?.verified_at).toBe(claims.verified_at);
    expect(typeof claims.verified_at).toBe('string');
  });

  it('refreshJWKS keeps an applied tombstone; only clearTombstones lifts it', async () => {
    const h = harness();
    const T0 = context.t0;
    h.setStep({ jwks: 'registry_v1' });
    for (const at of [T0 - 11 * 60, T0]) {
      setClocks(at, at);
      await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt);
    }
    h.setStep({ jwks: 'registry_tombstone_retired_delegation' });
    for (const at of [T0 + 11 * 60, T0 + 16 * 60]) {
      setClocks(at, at);
      h.proof.proofs.refreshJWKS();
      await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt);
    }
    expect((await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt)).reason).toBe('key_revoked');

    h.setStep({ jwks: 'registry_v1' });
    setClocks(T0 + 17 * 60, T0 + 17 * 60);
    h.proof.proofs.refreshJWKS();
    expect((await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt)).reason).toBe('key_revoked');
    expect(h.jwksFetches()).toBe(5);

    h.proof.proofs.clearTombstones();
    expect((await h.proof.proofs.verifyOffline(fixture.tokens.dlg_retired.jwt)).valid).toBe(true);
  });

  // Prose may name it — the cache's own header says what it replaced — but nothing may import it.
  const IMPORTS_REMOTE_JWKS = /import\s*\{[^}]*\bcreateRemoteJWKSet\b[^}]*\}\s*from/;

  it('the offline-verify modules no longer import createRemoteJWKSet', () => {
    for (const file of ['../resources/proofs.ts', '../jwks/key-set-cache.ts', '../jwks/keyset.ts']) {
      const source = readFileSync(join(here, file), 'utf-8');
      expect(source.length, file).toBeGreaterThan(0);
      expect(source, file).not.toMatch(IMPORTS_REMOTE_JWKS);
    }
    // Positive controls: the pattern matches the import this task removed, in both of its shapes.
    expect("import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';").toMatch(IMPORTS_REMOTE_JWKS);
    expect("import {\n  jwtVerify,\n  createRemoteJWKSet,\n} from 'jose';").toMatch(IMPORTS_REMOTE_JWKS);
  });

  it('the README states that tombstones are kept in memory only', () => {
    const readme = readFileSync(join(here, '../../README.md'), 'utf-8');
    const section = readme.split(/^### /m).find((part) => part.startsWith('Signing-key rotation'));
    expect(section, 'README heading "### Signing-key rotation"').toBeDefined();
    expect(section).toMatch(/in memory/);
    expect(section).toMatch(/clearTombstones\(\)/);
    expect(section).toMatch(/not persisted/);
  });
});
