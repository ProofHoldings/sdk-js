import type { HttpClient } from '../http.js';
import type {
  Profile,
  ProfileListResponse,
  CreateProfileParams,
  UpdateProfileParams,
  DeleteProfileResponse,
  SetPrimaryProfileResponse,
  ProfileTemplateListResponse,
  UpdateProfileTemplateParams,
  ProfileTemplateResponse,
  PreviewProfileTemplateParams,
  PreviewProfileTemplateResponse,
} from '../types.js';

/** Scoped sub-resource for profile templates: client.profiles(id).templates.* */
export class ProfileTemplates {
  constructor(
    private readonly http: HttpClient,
    private readonly profileId: string,
  ) {}

  /** List all templates for this profile */
  list(): Promise<ProfileTemplateListResponse> {
    return this.http.get<ProfileTemplateListResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(this.profileId)}/templates`,
    );
  }

  /** Update (upsert) a template by channel and message type */
  update(
    channel: string,
    messageType: string,
    params: UpdateProfileTemplateParams,
  ): Promise<ProfileTemplateResponse> {
    return this.http.put<ProfileTemplateResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(this.profileId)}/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      params,
    );
  }

  /** Delete a custom template, reverting to the default */
  delete(
    channel: string,
    messageType: string,
  ): Promise<ProfileTemplateResponse> {
    return this.http.del<ProfileTemplateResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(this.profileId)}/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
    );
  }

  /** Preview a template with sample variables */
  preview(params: PreviewProfileTemplateParams): Promise<PreviewProfileTemplateResponse> {
    return this.http.post<PreviewProfileTemplateResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(this.profileId)}/templates/preview`,
      params,
    );
  }
}

/** Scoped profile instance returned by client.profiles(id) */
export class ScopedProfile {
  public readonly templates: ProfileTemplates;

  constructor(http: HttpClient, profileId: string) {
    this.templates = new ProfileTemplates(http, profileId);
  }
}

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
