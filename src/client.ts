import { HttpClient } from './http.js';
import { Verifications } from './resources/verifications.js';
import { VerificationRequests } from './resources/verification-requests.js';
import { Proofs } from './resources/proofs.js';
import { Sessions } from './resources/sessions.js';
import { WebhookDeliveries } from './resources/webhook-deliveries.js';
import { Templates } from './resources/templates.js';
import { Profiles } from './resources/profiles.js';
import { Projects } from './resources/projects.js';
import { Billing } from './resources/billing.js';
import { Phones } from './resources/phones.js';
import { Emails } from './resources/emails.js';
import { Assets } from './resources/assets.js';
import { Auth } from './resources/auth.js';
import { Settings } from './resources/settings.js';
import { ApiKeys } from './resources/api-keys.js';
import { Account } from './resources/account.js';
import { TwoFA } from './resources/two-fa.js';
import { DnsCredentials } from './resources/dns-credentials.js';
import { Domains } from './resources/domains.js';
import { UserRequests } from './resources/user-requests.js';
import { UserDomainVerify } from './resources/user-domain-verify.js';
import { PublicProfiles } from './resources/public-profiles.js';
import type { ProofOptions } from './types.js';

const DEFAULT_BASE_URL = 'https://api.proof.holdings';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export class Proof {
  public readonly verifications: Verifications;
  public readonly verificationRequests: VerificationRequests;
  public readonly proofs: Proofs;
  public readonly sessions: Sessions;
  public readonly webhookDeliveries: WebhookDeliveries;
  public readonly templates: Templates;
  public readonly profiles: Profiles;
  public readonly projects: Projects;
  public readonly billing: Billing;
  public readonly phones: Phones;
  public readonly emails: Emails;
  public readonly assets: Assets;
  public readonly auth: Auth;
  public readonly settings: Settings;
  public readonly apiKeys: ApiKeys;
  public readonly account: Account;
  public readonly twoFA: TwoFA;
  public readonly dnsCredentials: DnsCredentials;
  public readonly domains: Domains;
  public readonly userRequests: UserRequests;
  public readonly userDomainVerify: UserDomainVerify;
  public readonly publicProfiles: PublicProfiles;

  constructor(apiKey: string, options?: ProofOptions) {
    if (!apiKey) {
      throw new Error('API key is required. Pass your key as the first argument: new Proof("pk_live_...")');
    }

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
      baseUrl: options?.baseUrl ?? DEFAULT_BASE_URL,
      timeout: options?.timeout ?? DEFAULT_TIMEOUT,
      maxRetries: options?.maxRetries ?? DEFAULT_MAX_RETRIES,
      fetch: fetchFn,
    });

    this.verifications = new Verifications(http);
    this.verificationRequests = new VerificationRequests(http);
    this.proofs = new Proofs(http);
    this.sessions = new Sessions(http);
    this.webhookDeliveries = new WebhookDeliveries(http);
    this.templates = new Templates(http);
    this.profiles = new Profiles(http);
    this.projects = new Projects(http);
    this.billing = new Billing(http);
    this.phones = new Phones(http);
    this.emails = new Emails(http);
    this.assets = new Assets(http);
    this.auth = new Auth(http);
    this.settings = new Settings(http);
    this.apiKeys = new ApiKeys(http);
    this.account = new Account(http);
    this.twoFA = new TwoFA(http);
    this.dnsCredentials = new DnsCredentials(http);
    this.domains = new Domains(http);
    this.userRequests = new UserRequests(http);
    this.userDomainVerify = new UserDomainVerify(http);
    this.publicProfiles = new PublicProfiles(http);
  }
}
