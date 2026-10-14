import { HttpClient } from './http.js';
import { Verifications } from './resources/verifications.js';
import { VerificationRequests } from './resources/verification-requests.js';
import { Proofs } from './resources/proofs.js';
import { Sessions } from './resources/sessions.js';
import { WebhookDeliveries } from './resources/webhook-deliveries.js';
import { Confirmations } from './resources/confirmations.js';
import { AuthSessions } from './resources/auth-sessions.js';
import { Me } from './resources/me.js';
import { Hitl } from './resources/hitl.js';
import { HitlChatIdDiscovery } from './resources/hitl-chat-id.js';
import { HitlKeys } from './resources/hitl-keys.js';
import { Authorizations } from './resources/authorizations.js';
import { Templates } from './resources/templates.js';
import { Profiles } from './resources/profiles.js';
import { PublicProfiles } from './resources/public-profiles.js';
import { ProofMe } from './resources/proof-me.js';
import { Circles } from './resources/circles.js';
import { Delegations } from './resources/delegations.js';
import type { ProofOptions } from './types.js';
import { missingKeyMessage, resolveApiKey, resolveBaseUrl } from './credentials.js';

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export class Proof {
  public readonly verifications: Verifications;
  public readonly verificationRequests: VerificationRequests;
  public readonly proofs: Proofs;
  public readonly sessions: Sessions;
  public readonly webhookDeliveries: WebhookDeliveries;
  public readonly confirmations: Confirmations;
  public readonly authSessions: AuthSessions;
  public readonly me: Me;
  public readonly hitl: Hitl;
  public readonly hitlChatIdDiscovery: HitlChatIdDiscovery;
  public readonly hitlKeys: HitlKeys;
  public readonly authorizations: Authorizations;
  public readonly templates: Templates;
  public readonly profiles: Profiles;
  public readonly publicProfiles: PublicProfiles;
  public readonly proofMe: ProofMe;
  public readonly circles: Circles;
  public readonly delegations: Delegations;

  /**
   * With a key: `new Proof('pk_live_…', options?)`, used as given. Without one — `new Proof()` or
   * `new Proof(options)` — the key is resolved the way `npx @proof-holdings/mcp-server login`
   * expects: a non-empty `PROOF_API_KEY`, else the entry saved for this client's base URL in
   * `~/.proof-holdings/credentials`. An explicit empty key is an error and never reads either.
   */
  constructor(apiKey?: string, options?: ProofOptions);
  constructor(options?: ProofOptions);
  constructor(apiKeyOrOptions?: string | ProofOptions, maybeOptions?: ProofOptions) {
    const options = typeof apiKeyOrOptions === 'object' && apiKeyOrOptions !== null ? apiKeyOrOptions : maybeOptions;
    const explicit = typeof apiKeyOrOptions === 'string' ? apiKeyOrOptions : options?.apiKey;
    const baseUrl = resolveBaseUrl(options?.baseUrl);
    if (explicit === '') {
      throw new Error('API key is required. Pass your key as the first argument: new Proof("pk_live_...")');
    }
    const resolved = resolveApiKey({ explicit, baseUrl });
    if (!resolved.apiKey) {
      throw new Error(missingKeyMessage(baseUrl, resolved.notice));
    }
    const apiKey = resolved.apiKey;

    const fetchFn = options?.fetch ?? globalThis.fetch;
    if (!fetchFn) {
      throw new Error(
        'fetch is not available in this environment. ' +
        'Provide a custom fetch implementation via options.fetch, ' +
        'or use Node.js 18+ which includes native fetch.',
      );
    }

    const http = new HttpClient({
      apiKey,
      baseUrl,
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
      fetch: fetchFn,
    });

    this.verifications = new Verifications(http);
    this.verificationRequests = new VerificationRequests(http);
    this.proofs = new Proofs(http, { maxJwksAgeMs: options?.maxJwksAgeMs });
    this.sessions = new Sessions(http);
    this.webhookDeliveries = new WebhookDeliveries(http);
    this.confirmations = new Confirmations(http);
    this.authSessions = new AuthSessions(http);
    this.me = new Me(http);
    this.hitl = new Hitl(http);
    this.hitlChatIdDiscovery = new HitlChatIdDiscovery(http);
    this.hitlKeys = new HitlKeys(http);
    this.authorizations = new Authorizations(http);
    this.templates = new Templates(http);
    this.profiles = new Profiles(http);
    this.publicProfiles = new PublicProfiles(http);
    this.proofMe = new ProofMe(http);
    this.circles = new Circles(http);
    this.delegations = new Delegations(http);
  }
}
