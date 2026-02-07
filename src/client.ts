import { HttpClient } from './http.js';
import { Verifications } from './resources/verifications.js';
import { VerificationRequests } from './resources/verification-requests.js';
import { Proofs } from './resources/proofs.js';
import { Sessions } from './resources/sessions.js';
import { WebhookDeliveries } from './resources/webhook-deliveries.js';
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
  }
}
