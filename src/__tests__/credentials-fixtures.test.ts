/**
 * Key and base-URL resolution follows the MCP server's chain (m-implement-sdk-key-resolution).
 *
 * The shared cases in `sdks/shared/fixtures/credentials/cases.json` run here through the PUBLIC
 * surface — `new Proof(key, { fetch })` or `new Proof({ fetch, baseUrl? })` — with `HOME` pointed at
 * a temp directory holding the case's credentials file and the two variables set from the case.
 * What is asserted is what reaches the wire: the `Authorization` header the routed `fetch` records
 * and the origin it was sent to. The same file drives the MCP reference (through the root drift test)
 * and the other three SDKs, so a rule read differently here fails here.
 *
 * The origin, not the whole base URL, is compared: `buildUrl` resolves `/api/v1/…` against the base
 * the WHATWG way, which drops a base path. That the path still took part in the FILE lookup is what
 * the `Authorization` assertion of `path_prefix_is_part_of_the_key` proves.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Proof } from '../client.js';
import { LOGIN_COMMAND, resolveApiKey, resolveBaseUrl } from '../credentials.js';

interface FixtureCase {
  name: string;
  explicit?: string;
  env?: Record<string, string>;
  file: string | null;
  base_url: string | null;
  expect: {
    api_key: string | null;
    source: 'explicit' | 'env' | 'file' | 'none';
    base_url: string;
    notice: boolean;
    error: boolean;
  };
}

interface Fixture {
  login_command: string;
  default_base_url: string;
  files: Record<string, unknown>;
  cases: FixtureCase[];
}

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(here, '../../../shared/fixtures/credentials/cases.json');
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as Fixture;

const ENV_KEYS = ['PROOF_API_KEY', 'PROOF_BASE_URL'] as const;

interface Recorded {
  url?: string;
  authorization?: string | null;
}

/** A fetch that records the one request and answers an empty JSON body. */
function recorder(): { fetch: typeof globalThis.fetch; recorded: Recorded } {
  const recorded: Recorded = {};
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.url = String(input);
    recorded.authorization = new Headers(init?.headers).get('authorization');
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  return { fetch, recorded };
}

describe('credentials fixture — the shared cases through new Proof()', () => {
  let dir: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    saved.HOME = process.env.HOME;
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    dir = mkdtempSync(join(tmpdir(), 'proof-cred-'));
    process.env.HOME = dir;
  });

  afterEach(() => {
    for (const key of ['HOME', ...ENV_KEYS]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(dir, { recursive: true, force: true });
  });

  function arrange(testCase: FixtureCase): string {
    const file = join(dir, '.proof-holdings', 'credentials');
    if (testCase.file !== null) {
      mkdirSync(dirname(file), { recursive: true });
      const body = fixture.files[testCase.file];
      writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
    }
    const env = testCase.env ?? {};
    for (const key of ENV_KEYS) {
      if (key in env) process.env[key] = env[key];
      else delete process.env[key];
    }
    return file;
  }

  it.each(fixture.cases.map((testCase): [string, FixtureCase] => [testCase.name, testCase]))(
    '%s',
    async (_name, testCase) => {
      const file = arrange(testCase);
      const { fetch, recorded } = recorder();
      const build = () =>
        'explicit' in testCase
          ? new Proof(testCase.explicit, { fetch })
          : new Proof({ fetch, ...(testCase.base_url !== null ? { baseUrl: testCase.base_url } : {}) });

      if (testCase.expect.error) {
        let thrown: Error | undefined;
        try {
          build();
        } catch (e) {
          thrown = e as Error;
        }
        expect(thrown).toBeInstanceOf(Error);
        const message = thrown?.message ?? '';
        expect(message).toContain('API key is required');
        if ('explicit' in testCase) {
          // Today's error, verbatim: the chain was never consulted.
          expect(message).not.toContain(LOGIN_COMMAND);
        } else {
          expect(message).toContain(LOGIN_COMMAND);
          expect(message).toContain('PROOF_API_KEY');
        }
        expect(message.includes(file)).toBe(testCase.expect.notice);
        return;
      }

      const proof = build();
      await proof.verifications.retrieve('ver_x');
      expect(recorded.authorization).toBe(`Bearer ${testCase.expect.api_key}`);
      expect(new URL(recorded.url ?? '').origin).toBe(new URL(testCase.expect.base_url).origin);
    },
  );
});

describe('resolveApiKey — one direct case per source', () => {
  let dir: string;
  const baseUrl = 'https://api.proof.holdings';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'proof-cred-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function validFile(): string {
    const file = join(dir, 'credentials');
    writeFileSync(file, JSON.stringify(fixture.files.valid));
    return file;
  }

  it('explicit: used as given, even empty, without reading env or file', () => {
    const file = join(dir, 'credentials');
    writeFileSync(file, '{not json');
    const env = { PROOF_API_KEY: 'pk_live_env' };
    expect(resolveApiKey({ explicit: 'pk_live_x', baseUrl, file, env })).toEqual({ apiKey: 'pk_live_x', source: 'explicit' });
    expect(resolveApiKey({ explicit: '', baseUrl, file, env })).toEqual({ apiKey: '', source: 'explicit' });
  });

  it('env: a non-empty PROOF_API_KEY wins without reading the file', () => {
    const file = join(dir, 'credentials');
    writeFileSync(file, '{not json');
    const result = resolveApiKey({ baseUrl, file, env: { PROOF_API_KEY: 'pk_live_env' } });
    expect(result).toEqual({ apiKey: 'pk_live_env', source: 'env' });
  });

  it('file: the entry for exactly this base URL', () => {
    const file = validFile();
    expect(resolveApiKey({ baseUrl: 'https://API.Proof.Holdings:443/', file, env: {} })).toEqual({
      apiKey: 'pk_live_file_production',
      source: 'file',
    });
    expect(resolveApiKey({ baseUrl: 'http://localhost:3000/proxy/', file, env: { PROOF_API_KEY: '' } })).toEqual({
      apiKey: 'pk_test_file_proxy',
      source: 'file',
    });
  });

  it('none: silent without a file, a notice naming the file when it cannot be used', () => {
    const missing = join(dir, 'credentials');
    expect(resolveApiKey({ baseUrl, file: missing, env: {} })).toEqual({ source: 'none' });

    const file = validFile();
    expect(resolveApiKey({ baseUrl: 'https://api.staging.proof.holdings', file, env: {} })).toEqual({ source: 'none' });

    const broken = resolveApiKey({ baseUrl: 'not a url', file, env: {} });
    expect(broken.source).toBe('none');
    expect(broken.apiKey).toBeUndefined();
    expect(broken.notice).toContain(file);

    writeFileSync(file, JSON.stringify({ version: 2, credentials: {} }));
    const wrongVersion = resolveApiKey({ baseUrl, file, env: {} });
    expect(wrongVersion.source).toBe('none');
    expect(wrongVersion.notice).toContain(file);
    expect(wrongVersion.notice).toContain(LOGIN_COMMAND);
  });
});

describe('resolveBaseUrl', () => {
  it('explicit, else a non-empty PROOF_BASE_URL, else the default', () => {
    expect(resolveBaseUrl('http://localhost:3000', { PROOF_BASE_URL: 'https://api.staging.proof.holdings' })).toBe('http://localhost:3000');
    expect(resolveBaseUrl(undefined, { PROOF_BASE_URL: 'https://api.staging.proof.holdings' })).toBe('https://api.staging.proof.holdings');
    expect(resolveBaseUrl(undefined, { PROOF_BASE_URL: '' })).toBe(fixture.default_base_url);
    expect(resolveBaseUrl(undefined, {})).toBe(fixture.default_base_url);
  });
});
