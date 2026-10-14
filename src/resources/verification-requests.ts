import type { HttpClient } from '../http.js';
import { pollUntilComplete } from '../polling.js';
import { streamEndpoint, type StreamEvent, type StreamOptions } from '../streaming.js';
import type {
  VerificationRequest,
  VerificationRequestListItem,
  CancelVerificationRequestResponse,
  CreateVerificationRequestParams,
  ListVerificationRequestsParams,
  PaginatedList,
  VerificationRequestProofsResponse,
  WaitOptions,
} from '../types.js';

/** Asset-level status snapshot returned by the verify-request asset poll endpoint. */
export interface VerificationRequestAssetStatus {
  status: string;
  /** The parent request's status — `cancelled` or `expired` ends the stream while the asset stays `pending`. */
  request_status?: string;
  [key: string]: unknown;
}

/** The `connected` frame of `verificationRequests.streamAsset()`, written once when the connection opens. */
export interface VerificationRequestAssetStreamConnected {
  request_id: string;
  asset_index: number;
  status: string;
  request_status: string;
}

/**
 * The `update` frame of `verificationRequests.streamAsset()`: a status signal, not the asset status.
 * `verified`, `cancelled` and `expired` are the last frame — the server closes the stream after it;
 * `failed` is not, since a failed asset can be started again.
 */
export interface VerificationRequestAssetStreamUpdate {
  status: string;
  timestamp: string;
  /** Present on the `cancelled` / `expired` frames a closed request sends. */
  request_status?: string;
}

export type VerificationRequestAssetStreamEvent = StreamEvent<
  'update',
  VerificationRequestAssetStreamConnected,
  VerificationRequestAssetStreamUpdate,
  VerificationRequestAssetStatus
>;

const TERMINAL_STATES = ['completed', 'expired', 'cancelled'] as const;
const ASSET_TERMINAL_STATES = ['verified', 'failed', 'expired', 'revoked'] as const;
const ASSET_REQUEST_TERMINAL_STATES: readonly string[] = ['cancelled', 'expired'];

export class VerificationRequests {
  constructor(private readonly http: HttpClient) {}

  /** Create a multi-asset verification request */
  create(params: CreateVerificationRequestParams): Promise<VerificationRequest> {
    return this.http.post<VerificationRequest>('/api/v1/verification-requests', params);
  }

  /** Get a verification request by ID */
  retrieve(id: string): Promise<VerificationRequest> {
    return this.http.get<VerificationRequest>(`/api/v1/verification-requests/${encodeURIComponent(id)}`);
  }

  /** List verification requests with optional filters */
  list(params?: ListVerificationRequestsParams): Promise<PaginatedList<VerificationRequestListItem>> {
    return this.http.get<PaginatedList<VerificationRequestListItem>>('/api/v1/verification-requests', params as Record<string, string | number | boolean | undefined>);
  }

  /** Get a verification request by its reference ID */
  getByReference(referenceId: string): Promise<VerificationRequest> {
    return this.http.get<VerificationRequest>(`/api/v1/verification-requests/by-reference/${encodeURIComponent(referenceId)}`);
  }

  /** Cancel a pending verification request */
  cancel(id: string): Promise<CancelVerificationRequestResponse> {
    return this.http.del<CancelVerificationRequestResponse>(`/api/v1/verification-requests/${encodeURIComponent(id)}`);
  }

  /** Get proof tokens for verified assets of a verification request */
  getProofs(id: string): Promise<VerificationRequestProofsResponse> {
    return this.http.get<VerificationRequestProofsResponse>(
      `/api/v1/verification-requests/${encodeURIComponent(id)}/proofs`,
    );
  }

  /** Poll until the request reaches a terminal state. */
  waitForCompletion(id: string, options?: WaitOptions): Promise<VerificationRequest> {
    return pollUntilComplete(
      () => this.retrieve(id),
      TERMINAL_STATES,
      `Verification request ${id}`,
      options,
    );
  }

  /** Retrieve asset-level verification status (polling fallback target). */
  retrieveAssetStatus(id: string, assetIndex: number): Promise<VerificationRequestAssetStatus> {
    return this.http.get<VerificationRequestAssetStatus>(
      `/api/v1/verify/request/${encodeURIComponent(id)}/assets/${encodeURIComponent(String(assetIndex))}/status`,
    );
  }

  /**
   * Stream asset-level verification status via SSE (`connected` / `update`
   * signals), with a polling fallback that yields the asset status as
   * `poll` / `terminal` events.
   */
  streamAsset(
    id: string,
    assetIndex: number,
    options?: StreamOptions,
  ): AsyncIterable<VerificationRequestAssetStreamEvent> {
    return streamEndpoint<VerificationRequestAssetStatus, VerificationRequestAssetStreamEvent>(this.http, {
      path: `/api/v1/verify/request/${encodeURIComponent(id)}/assets/${encodeURIComponent(String(assetIndex))}/events`,
      retrieve: () => this.retrieveAssetStatus(id, assetIndex),
      terminalStates: ASSET_TERMINAL_STATES,
      isTerminal: (asset) =>
        asset.request_status !== undefined && ASSET_REQUEST_TERMINAL_STATES.includes(asset.request_status),
      label: `Verification request ${id} asset ${assetIndex}`,
    }, options);
  }
}
