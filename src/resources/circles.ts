import type { HttpClient } from '../http.js';
import type {
  Circle,
  CreateCircleParams,
  UpdateCircleParams,
  CircleListParams,
  CircleListResponse,
  CircleMember,
  CircleMemberListResponse,
  CreateCircleMemberParams,
  CircleMemberInviteResponse,
  CircleMemberDrillResponse,
  AddCircleMemberChannelParams,
  CircleMemberChannel,
  CircleMemberChannelListResponse,
} from '../types.js';

/**
 * Circle people-primitive: named groups of trusted contacts, their members, and
 * per-member channels. Member and channel responses expose reachability booleans
 * only — an identifier is NEVER returned (SEC-PM-006).
 */
export class Circles {
  constructor(private readonly http: HttpClient) {}

  /** Create a new Circle (optionally with initial members) */
  create(params: CreateCircleParams): Promise<Circle> {
    return this.http.post<Circle>('/api/v1/circles', params);
  }

  /** List Circles (archived excluded by default; pass `status: 'archived'` to surface them) */
  list(params?: CircleListParams): Promise<CircleListResponse> {
    return this.http.get<CircleListResponse>('/api/v1/circles', params);
  }

  /** Get a Circle by ID */
  retrieve(id: string): Promise<Circle> {
    return this.http.get<Circle>(`/api/v1/circles/${encodeURIComponent(id)}`);
  }

  /** Update a Circle's name (the profile binding is create-only) */
  update(id: string, params: UpdateCircleParams): Promise<Circle> {
    return this.http.request<Circle>(
      'PATCH',
      `/api/v1/circles/${encodeURIComponent(id)}`,
      { body: params },
    );
  }

  /** Archive a Circle (soft delete) */
  archive(id: string): Promise<void> {
    return this.http.del<void>(`/api/v1/circles/${encodeURIComponent(id)}`);
  }

  /** Add a pending member by name (+ an optional pre-declared WhatsApp phone) */
  addMember(id: string, params: CreateCircleMemberParams): Promise<CircleMember> {
    return this.http.post<CircleMember>(
      `/api/v1/circles/${encodeURIComponent(id)}/members`,
      params,
    );
  }

  /** List a Circle's members (channel presence booleans and a masked enrollment phone only, never an identifier) */
  listMembers(id: string): Promise<CircleMemberListResponse> {
    return this.http.get<CircleMemberListResponse>(
      `/api/v1/circles/${encodeURIComponent(id)}/members`,
    );
  }

  /** Mint a single-use enrollment deep link (both channels + QR) for a member */
  inviteMember(id: string, memberId: string): Promise<CircleMemberInviteResponse> {
    return this.http.post<CircleMemberInviteResponse>(
      `/api/v1/circles/${encodeURIComponent(id)}/members/invite`,
      { member_id: memberId },
    );
  }

  /** Fire a cross-channel Proof-Me identity challenge against an enrolled member */
  triggerDrill(id: string, memberId: string): Promise<CircleMemberDrillResponse> {
    return this.http.post<CircleMemberDrillResponse>(
      `/api/v1/circles/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}/drill`,
    );
  }

  /** Remove a member (deletes its channels and revokes its live authorizations) */
  removeMember(id: string, memberId: string): Promise<void> {
    return this.http.del<void>(
      `/api/v1/circles/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
    );
  }

  /** Declare a channel for a member (409 if that channel type already exists) */
  addMemberChannel(
    id: string,
    memberId: string,
    params: AddCircleMemberChannelParams,
  ): Promise<CircleMemberChannel> {
    return this.http.post<CircleMemberChannel>(
      `/api/v1/circles/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}/channels`,
      params,
    );
  }

  /** List a member's channels (metadata only, never an identifier) */
  listMemberChannels(id: string, memberId: string): Promise<CircleMemberChannelListResponse> {
    return this.http.get<CircleMemberChannelListResponse>(
      `/api/v1/circles/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}/channels`,
    );
  }

  /** Remove a member channel (removing the last channel is allowed) */
  removeMemberChannel(id: string, memberId: string, channelId: string): Promise<void> {
    return this.http.del<void>(
      `/api/v1/circles/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}/channels/${encodeURIComponent(channelId)}`,
    );
  }
}
