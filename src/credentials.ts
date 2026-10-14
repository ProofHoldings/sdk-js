/**
 * Where the key comes from when `new Proof()` is given none.
 *
 * The chain is the MCP server's (`mcp/src/credentials.ts`, the reference): a non-empty
 * `PROOF_API_KEY`, else the entry `npx @proof-holdings/mcp-server login` saved for exactly this
 * base URL in `~/.proof-holdings/credentials`, else none. It runs ONLY when the key argument is
 * omitted — an explicit key is used as given, and an explicit empty one is the caller's error and
 * never reads the environment or the file (a multi-tenant host passing a tenant's key must not
 * fall through to its own). The shared cases in `sdks/shared/fixtures/credentials/cases.json`
 * hold this module and the other three SDKs to the reference.
 *
 * Node built-ins only, like the reference: the client imports this on every construction.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The scoped command, never the bare bin name: through npx the unscoped name resolves to a package somebody else publishes. */
export const LOGIN_COMMAND = 'npx @proof-holdings/mcp-server login';
export const DEFAULT_BASE_URL = 'https://api.proof.holdings';

export interface StoredCredential {
  api_key: string;
  key_id: string;
  name: string;
  environment: 'production' | 'test';
  created_at: string;
}

export interface CredentialsFile {
  version: 1;
  credentials: Record<string, StoredCredential>;
}

export type KeySource = 'explicit' | 'env' | 'file' | 'none';

export interface ResolvedKey {
  apiKey?: string;
  source: KeySource;
  /** Why the file could not be used, when it exists but was not read — never a key. */
  notice?: string;
}

/** The file exists but cannot be read or is not a credentials file this version understands. */
export class CredentialsFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialsFileError';
  }
}

export function defaultCredentialsPath(): string {
  return join(homedir(), '.proof-holdings', 'credentials');
}

/** Origin plus path, no trailing slash — the entry name `npx @proof-holdings/mcp-server login` saves under. */
export function credentialKey(baseUrl: string): string {
  const url = new URL(baseUrl);
  return url.origin + url.pathname.replace(/\/+$/, '');
}

/** Explicit, else a non-empty PROOF_BASE_URL, else the default. */
export function resolveBaseUrl(explicit?: string, env: NodeJS.ProcessEnv = process.env): string {
  return explicit ?? (env.PROOF_BASE_URL || DEFAULT_BASE_URL);
}

function isStoredCredential(value: unknown): value is StoredCredential {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.api_key === 'string' && v.api_key.startsWith('pk_') &&
    typeof v.key_id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.created_at === 'string' &&
    (v.environment === 'production' || v.environment === 'test')
  );
}

/** The parsed file, `null` when there is none, `CredentialsFileError` when it is unreadable or malformed. */
export function readCredentialsFile(file: string): CredentialsFile | null {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new CredentialsFileError(`cannot read ${file}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CredentialsFileError(`${file} is not valid JSON`);
  }
  const p = parsed as Partial<CredentialsFile> | null;
  if (!p || typeof p !== 'object' || p.version !== 1 || !p.credentials || typeof p.credentials !== 'object' || Array.isArray(p.credentials)) {
    throw new CredentialsFileError(`${file} is not a version 1 Proof credentials file`);
  }
  for (const [key, value] of Object.entries(p.credentials)) {
    if (!isStoredCredential(value)) throw new CredentialsFileError(`${file} has a malformed entry for ${key}`);
  }
  return p as CredentialsFile;
}

/**
 * The chain: an explicit key as given (the constructor decides whether `''` is acceptable), else a
 * non-empty `PROOF_API_KEY`, else the saved entry for exactly `baseUrl`, else none. A broken file or
 * a base URL that is not a URL never throws here — it becomes a notice on the `none` answer.
 */
export function resolveApiKey(opts: { explicit?: string; baseUrl: string; file?: string; env?: NodeJS.ProcessEnv }): ResolvedKey {
  if (typeof opts.explicit === 'string') return { apiKey: opts.explicit, source: 'explicit' };
  const env = opts.env ?? process.env;
  if (env.PROOF_API_KEY) return { apiKey: env.PROOF_API_KEY, source: 'env' };
  let file: string;
  try {
    file = opts.file ?? defaultCredentialsPath();
  } catch {
    // No home directory to look in (a sandbox without one): the same answer as no file.
    return { source: 'none' };
  }
  let contents: CredentialsFile | null;
  try {
    contents = readCredentialsFile(file);
  } catch (e) {
    return {
      source: 'none',
      notice: `ignoring the saved credentials — ${(e as Error).message}. Fix or delete ${file}, then run ${LOGIN_COMMAND}.`,
    };
  }
  if (!contents) return { source: 'none' };
  let key: string;
  try {
    key = credentialKey(opts.baseUrl);
  } catch {
    return {
      source: 'none',
      notice: `the base URL ${JSON.stringify(opts.baseUrl)} is not a URL, so the saved credentials in ${file} were not read.`,
    };
  }
  const entry = contents.credentials[key];
  return entry ? { apiKey: entry.api_key, source: 'file' } : { source: 'none' };
}

/** The one message a missing key produces, whatever road the caller tried. */
export function missingKeyMessage(baseUrl: string, notice?: string): string {
  return (
    `API key is required. Pass your key as the first argument: new Proof("pk_live_..."), ` +
    `set PROOF_API_KEY, or run \`${LOGIN_COMMAND}\` to save one for ${baseUrl}.` +
    (notice ? ` ${notice}` : '')
  );
}
