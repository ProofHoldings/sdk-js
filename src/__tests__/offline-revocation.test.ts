/**
 * Offline verification reads the token's status list (h-sdk-offline-revocation).
 *
 * Before this task `verifyOffline` checked the signature, `iss` and `exp` and stopped, so a
 * REVOKED proof verified as valid — measured against production on 2026-09-20. The token carries
 * its own slot in the issuer's signed status list; these cases pin that the slot is now read, that
 * an unreadable list fails closed rather than silently passing, and that a token carrying no slot
 * at all stays valid — which is what the issuer's own `POST /proofs/validate` answers for it.
 *
 * Most of the suite runs against a real loopback HTTP server, so the reads cross a real socket. The
 * SDK's configured fetch, which both the key set and the status list go through, is wrapped in a
 * spy on top, so a case can still assert that a request was never made.
 *
 * The packed list comes from `sdks/shared/fixtures/status_list_slots.json`, the same fixture the
 * issuer's drift suite and the other three SDKs read, so a disagreement about the byte order
 * fails here rather than in production.
 *
 * Which status-list origins may be fetched comes from `sdks/shared/fixtures/status_list_origin.json`,
 * shared with the other three SDKs and `delegation-verifier`. Those cases need a fixed https origin,
 * a default port and an uppercase host, none of which a loopback server can be, so they run through
 * a routed fetch instead.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AddressInfo } from 'node:net';

import * as jose from 'jose';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { HttpClient } from '../http.js';
import { Proofs } from '../resources/proofs.js';

const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../shared/fixtures/status_list_slots.json'),
    'utf-8',
  ),
) as {
  bits: number;
  capacity_slots: number;
  lst: string;
  slots: Record<string, string>;
  beyond_end_index: number;
};

const ORIGIN_FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../../shared/fixtures/status_list_origin.json'),
    'utf-8',
  ),
) as {
  configured_origin: string;
  cases: Array<{ name: string; uri: string; sdk: 'accepted' | 'rejected'; uri_origin?: string }>;
};

const KID = 'test-key-1';

let baseUrl: string;
let statusListUrl: string;
let server: Server;
let privateKey: jose.KeyLike;
let jwks: { keys: jose.JWK[] };
let foreignPrivateKey: jose.KeyLike;

/** What the status-list route should answer for the case currently running. */
type StatusListReply =
  | { kind: 'token'; overrides?: StatusListOverrides }
  | { kind: 'status'; code: number }
  | { kind: 'oversized'; declareLength?: boolean }
  | { kind: 'hangup' }
  /** Headers, then the socket dies — a body that breaks AFTER the response is handed over. */
  | { kind: 'hangup-mid-body' };

let statusListReply: StatusListReply;
/** What the key-set route should answer — an outage is a case of its own. */
let jwksReply: 'keys' | 'error';

interface StatusListOverrides {
  typ?: string;
  sub?: string;
  expiresIn?: string;
  key?: jose.KeyLike;
  omitExp?: boolean;
}

/** A proof token as the issuer mints it, optionally carrying a status-list slot. */
async function mintProof(options?: {
  statusList?: { idx: number; uri: string } | null;
  key?: jose.KeyLike;
  issuer?: string;
}): Promise<string> {
  const claims: Record<string, unknown> = {
    type: 'phone',
    channel: 'whatsapp',
    identifier_hash: 'abc123',
    verified_at: new Date().toISOString(),
    user_id: 'usr_1',
  };
  if (options?.statusList !== null) {
    claims.status = { status_list: options?.statusList ?? { idx: 1, uri: statusListUrl } };
  }

  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256', kid: KID })
    .setIssuer(options?.issuer ?? 'proof.holdings')
    .setSubject('ph_ctl_0123456789abcdef0123456789abcdef')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(options?.key ?? privateKey);
}

/** The signed status list, as `GET /api/v1/proofs/status-list` serves it. */
async function mintStatusList(overrides?: StatusListOverrides): Promise<string> {
  const builder = new jose.SignJWT({ status_list: { bits: FIXTURE.bits, lst: FIXTURE.lst } })
    .setProtectedHeader({ alg: 'ES256', kid: KID, typ: overrides?.typ ?? 'statuslist+jwt' })
    .setSubject(overrides?.sub ?? statusListUrl)
    .setIssuedAt();

  if (!overrides?.omitExp) builder.setExpirationTime(overrides?.expiresIn ?? '5m');

  return builder.sign(overrides?.key ?? privateKey);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.url === '/.well-known/jwks.json') {
    if (jwksReply === 'error') {
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end('unavailable');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(jwks));
    return;
  }

  if (req.url === '/api/v1/proofs/status-list') {
    switch (statusListReply.kind) {
      case 'hangup':
        req.socket.destroy();
        return;
      case 'hangup-mid-body':
        res.writeHead(200, {
          'content-type': 'application/statuslist+jwt',
          'content-length': '4096',
        });
        res.write('x'.repeat(16));
        setTimeout(() => req.socket.destroy(), 10);
        return;
      case 'status':
        res.writeHead(statusListReply.code, { 'content-type': 'text/plain' });
        res.end('unavailable');
        return;
      case 'oversized': {
        const body = 'x'.repeat(600 * 1024);
        res.writeHead(200, {
          'content-type': 'application/statuslist+jwt',
          // Declared or not: the declared-length check and the read-length ceiling are two
          // separate guards, and a fixture that trips both pins neither on its own.
          ...(statusListReply.declareLength === false ? {} : { 'content-length': String(body.length) }),
        });
        res.end(body);
        return;
      }
      case 'token': {
        const token = await mintStatusList(statusListReply.overrides);
        res.writeHead(200, { 'content-type': 'application/statuslist+jwt' });
        res.end(token);
        return;
      }
    }
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
}

interface Harness {
  proofs: Proofs;
  fetchSpy: ReturnType<typeof vi.fn>;
}

/** A fresh resource per case: the JWKS cache and the status-list cache both live on it. */
function harness(): Harness {
  const fetchSpy = vi.fn((...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args));
  const proofs = new Proofs(
    new HttpClient({
      apiKey: 'pk_test_key',
      baseUrl,
      timeout: 5000,
      maxRetries: 0,
      fetch: fetchSpy as unknown as typeof globalThis.fetch,
    }),
  );
  return { proofs, fetchSpy };
}

function requestedUrls(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.calls.map(([input]) =>
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url,
  );
}

beforeAll(async () => {
  const pair = await jose.generateKeyPair('ES256', { extractable: true });
  privateKey = pair.privateKey;
  jwks = {
    keys: [{ ...(await jose.exportJWK(pair.publicKey)), kid: KID, alg: 'ES256', use: 'sig' }],
  };
  foreignPrivateKey = (await jose.generateKeyPair('ES256', { extractable: true })).privateKey;

  server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      res.writeHead(500);
      res.end('handler failed');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  statusListUrl = `${baseUrl}/api/v1/proofs/status-list`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  statusListReply = { kind: 'token' };
  jwksReply = 'keys';
});

describe('verifyOffline — revocation is checked by default', () => {
  it('refuses a proof whose slot is marked revoked', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ statusList: { idx: 1, uri: statusListUrl } }));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('revoked');
    expect(result.revocation_checked).toBe(true);
  });

  it('refuses a proof whose slot is marked suspended', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ statusList: { idx: 2, uri: statusListUrl } }));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('suspended');
    expect(result.revocation_checked).toBe(true);
  });

  it('accepts a proof whose slot is clear, and says revocation was checked', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));

    expect(result.error).toBeUndefined();
    expect(result.valid).toBe(true);
    expect(result.revocation_checked).toBe(true);
    expect(result.payload?.user_id).toBe('usr_1');
  });

  it('refuses a slot carrying the application-reserved value', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ statusList: { idx: 3, uri: statusListUrl } }));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
    expect(result.revocation_checked).toBe(false);
  });

  it('refuses a slot the published list does not reach', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(
      await mintProof({ statusList: { idx: FIXTURE.beyond_end_index, uri: statusListUrl } }),
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
  });
});

describe('verifyOffline — a token with no slot', () => {
  it('stays valid, reports that revocation was not checked, and asks for no list', async () => {
    const { proofs, fetchSpy } = harness();

    const result = await proofs.verifyOffline(await mintProof({ statusList: null }));

    // The issuer answers `valid: true` for a token it cannot resolve in the registry
    // (src/controllers/proofs.ts) — a client refusing it would be stricter than the server.
    expect(result.valid).toBe(true);
    expect(result.revocation_checked).toBe(false);
    expect(result.reason).toBeUndefined();
    expect(requestedUrls(fetchSpy).filter((url) => url.includes('status-list'))).toEqual([]);
  });
});

describe('verifyOffline — an unreadable list fails closed', () => {
  it('reports status_unavailable when the connection drops', async () => {
    statusListReply = { kind: 'hangup' };
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof());

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
    expect(result.revocation_checked).toBe(false);
  });

  it('reports status_unavailable on an HTTP error', async () => {
    statusListReply = { kind: 'status', code: 503 };
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof());

    expect(result.reason).toBe('status_unavailable');
  });

  // Both cases assert the MESSAGE, not just the reason: a 600 KiB run of `x` also fails to parse
  // as a JWT, so `status_unavailable` alone stays green with the size ceiling deleted.
  it('reports status_unavailable when the body is oversized', async () => {
    statusListReply = { kind: 'oversized' };
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof());

    expect(result.reason).toBe('status_unavailable');
    expect(result.error).toContain('too large');
  });

  it('reports status_unavailable for an oversized body that declares no length', async () => {
    statusListReply = { kind: 'oversized', declareLength: false };
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof());

    expect(result.reason).toBe('status_unavailable');
    expect(result.error).toContain('too large');
  });

  it('reports status_unavailable when the body breaks after the headers', async () => {
    // A different path from `hangup`, which kills the socket BEFORE the headers: here the fetch
    // resolves and the READ rejects, which used to throw straight out of verifyOffline because
    // the body read sat outside the try that wrapped the fetch.
    statusListReply = { kind: 'hangup-mid-body' };
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof());

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
  });

  it('refuses a status-list uri on a foreign origin WITHOUT contacting it', async () => {
    const { proofs, fetchSpy } = harness();
    const token = await mintProof({
      statusList: { idx: 1, uri: 'https://evil.example.net/api/v1/proofs/status-list' },
    });

    const result = await proofs.verifyOffline(token);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
    expect(requestedUrls(fetchSpy).some((url) => url.includes('evil.example.net'))).toBe(false);
  });
});

describe('verifyOffline — what makes a status list acceptable', () => {
  it('refuses a list that does not declare typ statuslist+jwt', async () => {
    statusListReply = { kind: 'token', overrides: { typ: 'JWT' } };
    const { proofs } = harness();

    expect((await proofs.verifyOffline(await mintProof())).reason).toBe('status_unavailable');
  });

  it('refuses a list whose sub is not the uri it was fetched from', async () => {
    statusListReply = { kind: 'token', overrides: { sub: 'https://api.example.com/other-list' } };
    const { proofs } = harness();

    expect((await proofs.verifyOffline(await mintProof())).reason).toBe('status_unavailable');
  });

  it('refuses an expired list', async () => {
    statusListReply = { kind: 'token', overrides: { expiresIn: '-1h' } };
    const { proofs } = harness();

    expect((await proofs.verifyOffline(await mintProof())).reason).toBe('status_unavailable');
  });

  it('refuses a list carrying no exp at all', async () => {
    statusListReply = { kind: 'token', overrides: { omitExp: true } };
    const { proofs } = harness();

    expect((await proofs.verifyOffline(await mintProof())).reason).toBe('status_unavailable');
  });

  it('refuses a list signed by a key the issuer does not publish', async () => {
    statusListReply = { kind: 'token', overrides: { key: foreignPrivateKey } };
    const { proofs } = harness();

    expect((await proofs.verifyOffline(await mintProof())).reason).toBe('status_unavailable');
  });

  it('accepts a list that carries no iss — the issuer does not put one in it', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));

    expect(result.valid).toBe(true);
    expect(result.revocation_checked).toBe(true);
  });
});

describe('verifyOffline — the opt-out', () => {
  it('returns to signature-only checking and says revocation was not checked', async () => {
    const { proofs, fetchSpy } = harness();
    const revoked = await mintProof({ statusList: { idx: 1, uri: statusListUrl } });

    const result = await proofs.verifyOffline(revoked, { checkRevocation: false });

    expect(result.valid).toBe(true);
    expect(result.revocation_checked).toBe(false);
    expect(requestedUrls(fetchSpy).filter((url) => url.includes('status-list'))).toEqual([]);
  });
});

describe('verifyOffline — signature failures keep their own reason', () => {
  it('reports invalid for a token signed by a foreign key', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ key: foreignPrivateKey }));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid');
    expect(result.revocation_checked).toBe(false);
  });

  it('reports invalid for a token from another issuer', async () => {
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof({ issuer: 'evil.example.net' }));

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid');
  });
});

describe('verifyOffline — the shared slot fixture', () => {
  it('reads every named slot the way the fixture says the issuer packed it', async () => {
    const expected: Record<string, { valid: boolean; reason?: string }> = {
      valid: { valid: true },
      revoked: { valid: false, reason: 'revoked' },
      suspended: { valid: false, reason: 'suspended' },
      unavailable: { valid: false, reason: 'status_unavailable' },
    };

    for (const [index, name] of Object.entries(FIXTURE.slots)) {
      const { proofs } = harness();
      const token = await mintProof({ statusList: { idx: Number(index), uri: statusListUrl } });

      const result = await proofs.verifyOffline(token);

      expect({ index, valid: result.valid, reason: result.reason }).toEqual({
        index,
        valid: expected[name].valid,
        reason: expected[name].reason,
      });
    }
  });
});

describe('verifyOffline — the status-list cache', () => {
  it('reads the list once across two verifications', async () => {
    const { proofs, fetchSpy } = harness();

    await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));
    await proofs.verifyOffline(await mintProof({ statusList: { idx: 1, uri: statusListUrl } }));

    expect(requestedUrls(fetchSpy).filter((url) => url.includes('status-list'))).toHaveLength(1);
  });

  it('reads it again once the cached copy\'s window has passed', async () => {
    // That window is what keeps the product's 60-second revocation-visibility promise on the
    // client side: past it the list must be re-read, or a revocation stays invisible for as long
    // as the proof itself lives. Fake timers are deliberately not used here — they would also
    // freeze the abort timeout and the loopback server this suite runs against; expiring the
    // held copy directly tests the same field the cache branches on.
    const { proofs, fetchSpy } = harness();
    await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));

    const held = (proofs as unknown as { statusListCache: { expiresAtMs: number } }).statusListCache;
    expect(held.expiresAtMs).toBeGreaterThan(Date.now());
    held.expiresAtMs = Date.now() - 1;

    await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));

    expect(requestedUrls(fetchSpy).filter((url) => url.includes('status-list'))).toHaveLength(2);
  });

  it('is dropped by refreshJWKS, which the key set it is verified against shares', async () => {
    const { proofs, fetchSpy } = harness();
    await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));

    proofs.refreshJWKS();
    await proofs.verifyOffline(await mintProof({ statusList: { idx: 0, uri: statusListUrl } }));

    expect(requestedUrls(fetchSpy).filter((url) => url.includes('status-list'))).toHaveLength(2);
  });
});

describe('verifyOffline — an unreadable key set', () => {
  it('is not reported as a forgery', async () => {
    jwksReply = 'error';
    const { proofs } = harness();

    const result = await proofs.verifyOffline(await mintProof());

    // `invalid` is a forged signature's answer; an outage at the key set is "I could not check",
    // and the two must stay distinguishable to a caller deciding what to do next.
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
    expect(result.revocation_checked).toBe(false);
  });

  it('answers the same way when the key set host cannot be reached at all', async () => {
    // A different code path in `jose`: an unreachable host is a plain transport Error, a non-200
    // is a JOSEError. Both mean "I could not check".
    const unreachable = new Proofs(
      new HttpClient({
        apiKey: 'pk_test_key',
        baseUrl: 'http://127.0.0.1:1',
        timeout: 5000,
        maxRetries: 0,
        fetch: globalThis.fetch,
      }),
    );

    const result = await unreachable.verifyOffline(await mintProof());

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
  });
});

describe('verifyOffline — the shared status-list origin fixture', () => {
  const configured = ORIGIN_FIXTURE.configured_origin;
  const jwksUrl = `${configured}/.well-known/jwks.json`;

  /** A client configured against the fixture's origin, whose fetch serves only the key set. */
  function originHarness(): { proofs: Proofs; requested: string[] } {
    const requested: string[] = [];
    const routedFetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      requested.push(url);
      if (url === jwksUrl) {
        return new Response(JSON.stringify(jwks), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;
    const proofs = new Proofs(
      new HttpClient({ apiKey: 'pk_test_key', baseUrl: configured, timeout: 5000, maxRetries: 0, fetch: routedFetch }),
    );
    return { proofs, requested };
  }

  it.each(ORIGIN_FIXTURE.cases)('$name: the status list is $sdk', async (testCase) => {
    const { proofs, requested } = originHarness();
    const listPath = new URL(testCase.uri).pathname;

    const result = await proofs.verifyOffline(await mintProof({ statusList: { idx: 1, uri: testCase.uri } }));
    const listRequests = requested.filter((url) => new URL(url).pathname === listPath);

    // The key set was read and the signature passed, so the origin rule is what decided the rest.
    expect(requested).toContain(jwksUrl);
    expect(result.payload).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('status_unavailable');
    expect(result.revocation_checked).toBe(false);

    if (testCase.sdk === 'accepted') {
      // The list itself is a 404 here: what is pinned is that the origin rule let the request go.
      expect(listRequests).toHaveLength(1);
      expect(new URL(listRequests[0]).origin).toBe(configured);
      expect(result.error).not.toMatch(/configured issuer origin/);
    } else {
      expect(listRequests).toEqual([]);
      expect(result.error).toBe(
        `status list uri origin ${testCase.uri_origin} is not the configured issuer origin ${configured}`,
      );
    }
  });
});
