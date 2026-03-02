import type { HttpClient } from '../http.js';
import type {
  Profile,
  ProfileListResponse,
  CreateProfileParams,
  UpdateProfileParams,
  DeleteProfileResponse,
  SetPrimaryProfileResponse,
} from '../types.js';

export class Profiles {
  constructor(private readonly http: HttpClient) {}

  /** List all profiles for the authenticated user */
  list(): Promise<ProfileListResponse> {
    return this.http.get<ProfileListResponse>('/api/v1/me/profiles');
  }

  /** Create a new profile */
  create(params: CreateProfileParams): Promise<Profile> {
    return this.http.post<Profile>('/api/v1/me/profiles', params);
  }

  /** Get a specific profile by ID */
  retrieve(profileId: string): Promise<Profile> {
    return this.http.get<Profile>(`/api/v1/me/profiles/${encodeURIComponent(profileId)}`);
  }

  /** Update a specific profile */
  update(profileId: string, params: UpdateProfileParams): Promise<Profile> {
    return this.http.patch<Profile>(`/api/v1/me/profiles/${encodeURIComponent(profileId)}`, params);
  }

  /** Delete a profile */
  delete(profileId: string): Promise<DeleteProfileResponse> {
    return this.http.del<DeleteProfileResponse>(`/api/v1/me/profiles/${encodeURIComponent(profileId)}`);
  }

  /** Set a profile as the primary profile */
  setPrimary(profileId: string): Promise<SetPrimaryProfileResponse> {
    return this.http.post<SetPrimaryProfileResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}/primary`,
    );
  }
}
