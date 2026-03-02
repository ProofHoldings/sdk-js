import type { HttpClient } from '../http.js';
import type { SuccessResponse } from '../types.js';

export class PublicProfiles {
  constructor(private readonly http: HttpClient) {}

  // --- Public endpoints ---

  /** Get public profile by profile ID. */
  getById(profileId: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/v1/profiles/p/${encodeURIComponent(profileId)}`);
  }

  /** Get profile avatar image. */
  getAvatar(profileId: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/v1/profiles/p/${encodeURIComponent(profileId)}/avatar`);
  }

  /** Get public profile by username. */
  getByUsername(username: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/v1/profiles/u/${encodeURIComponent(username)}`);
  }

  /** Check username availability. */
  checkUsername(username: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/v1/profiles/check-username/${encodeURIComponent(username)}`);
  }

  // --- Multi-profile endpoints ---

  /** List all profiles. */
  listProfiles(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/v1/profiles/profiles');
  }

  /** Create a new profile. */
  createProfile(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>('/api/v1/profiles/profiles', params);
  }

  /** Get a specific profile by ID. */
  getProfile(profileId: string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`/api/v1/profiles/profiles/${encodeURIComponent(profileId)}`);
  }

  /** Update a specific profile. */
  updateProfile(profileId: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<Record<string, unknown>>(`/api/v1/profiles/profiles/${encodeURIComponent(profileId)}`, params);
  }

  /** Delete a profile. */
  deleteProfile(profileId: string): Promise<SuccessResponse> {
    return this.http.del<SuccessResponse>(`/api/v1/profiles/profiles/${encodeURIComponent(profileId)}`);
  }

  /** Set a profile as primary. */
  setPrimary(profileId: string): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>(`/api/v1/profiles/profiles/${encodeURIComponent(profileId)}/primary`);
  }

  /** Update proofs for a specific profile. */
  updateProfileProofs(profileId: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>(`/api/v1/profiles/profiles/${encodeURIComponent(profileId)}/proofs`, params);
  }

  // --- Legacy /me endpoints ---

  /** Get current user's primary profile. */
  getMyProfile(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/v1/profiles/me');
  }

  /** Update current user's profile. */
  updateMyProfile(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>('/api/v1/profiles/me', params);
  }

  /** Claim a username. */
  claimUsername(params: { username: string }): Promise<SuccessResponse> {
    return this.http.post<SuccessResponse>('/api/v1/profiles/me/username', params);
  }

  /** Get available assets for public profile. */
  getAvailableAssets(): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>('/api/v1/profiles/me/assets');
  }

  /** Update public proofs. */
  updatePublicProofs(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.put<Record<string, unknown>>('/api/v1/profiles/me/proofs', params);
  }
}
