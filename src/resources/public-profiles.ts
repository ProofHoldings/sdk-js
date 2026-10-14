import type { HttpClient } from '../http.js';
import type {
  ProfileBadge,
  PublicProfileView,
  UsernameAvailabilityResponse,
  AvatarResponse,
} from '../types.js';

/**
 * Public profile reads — unauthenticated endpoints; the client's
 * Authorization header is sent but ignored by the server.
 */
export class PublicProfiles {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get a public profile by its PUBLIC `profile_id` (the `profile_id` field
   * on `/me/profiles` responses) — the internal `id` is NOT accepted by this
   * endpoint and will 404.
   */
  getById(profileId: string): Promise<PublicProfileView> {
    return this.http.get<PublicProfileView>(`/api/v1/profiles/p/${encodeURIComponent(profileId)}`);
  }

  /**
   * Get a profile's avatar image. Accepts either the public `profile_id` or
   * the internal `id`. Returns raw bytes plus the content type; https-hosted
   * avatars are followed through the server's 301 redirect.
   */
  getAvatar(profileId: string): Promise<AvatarResponse> {
    return this.http.get<AvatarResponse>(`/api/v1/profiles/p/${encodeURIComponent(profileId)}/avatar`);
  }

  /** Get a public profile by username */
  getByUsername(username: string): Promise<PublicProfileView> {
    return this.http.get<PublicProfileView>(`/api/v1/profiles/u/${encodeURIComponent(username)}`);
  }

  /**
   * Get the embeddable badge descriptor for a username.
   *
   * Everything needed to embed the verification badge in one call: the subject it asserts, the
   * live verified count, the badge image URL for each style, and ready-to-paste snippets. A
   * username with no public record answers 200 with `state: 'no_public_record'` rather than a
   * 404, so a caller never has to treat "nothing to show" as an error.
   */
  getBadge(username: string): Promise<ProfileBadge> {
    return this.http.get<ProfileBadge>(`/api/v1/profiles/badge/${encodeURIComponent(username)}`);
  }

  /** Check username availability */
  checkUsername(username: string): Promise<UsernameAvailabilityResponse> {
    return this.http.get<UsernameAvailabilityResponse>(
      `/api/v1/profiles/check-username/${encodeURIComponent(username)}`,
    );
  }
}
