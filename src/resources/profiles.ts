import type { HttpClient } from '../http.js';
import type {
  Profile,
  CreateProfileParams,
  UpdateProfileParams,
  ProfileListResponse,
  ProfileDeleteResponse,
  ProfileTemplate,
  ProfileTemplateListResponse,
  ProfileTemplateUpdateParams,
  ProfileTemplatePreviewParams,
  ProfileTemplatePreviewResponse,
  TemplateChannel,
  TemplateMessageType,
} from '../types.js';

export class Profiles {
  constructor(private readonly http: HttpClient) {}

  /** List all profiles for the authenticated user */
  list(): Promise<ProfileListResponse> {
    return this.http.get<ProfileListResponse>('/api/v1/me/profiles');
  }

  /** Create a new profile */
  create(params?: CreateProfileParams): Promise<Profile> {
    return this.http.post<Profile>('/api/v1/me/profiles', params);
  }

  /** Get a profile by ID */
  retrieve(profileId: string): Promise<Profile> {
    return this.http.get<Profile>(`/api/v1/me/profiles/${encodeURIComponent(profileId)}`);
  }

  /** Update a profile */
  update(profileId: string, params: UpdateProfileParams): Promise<Profile> {
    return this.http.request<Profile>(
      'PATCH',
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}`,
      { body: params },
    );
  }

  /** Delete a profile */
  delete(profileId: string): Promise<ProfileDeleteResponse> {
    return this.http.del<ProfileDeleteResponse>(`/api/v1/me/profiles/${encodeURIComponent(profileId)}`);
  }

  /** Set a profile as the primary profile */
  setPrimary(profileId: string): Promise<Profile> {
    return this.http.post<Profile>(`/api/v1/me/profiles/${encodeURIComponent(profileId)}/primary`);
  }

  /**
   * List a profile's message templates (custom and default)
   *
   * @deprecated The server retired this route (410 `endpoint_retired`). Use
   * `templates.list({ profileId })`.
   */
  listTemplates(profileId: string): Promise<ProfileTemplateListResponse> {
    return this.http.get<ProfileTemplateListResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}/templates`,
    );
  }

  /**
   * Create or update a profile template for a channel/message type
   *
   * @deprecated The server retired this route (410 `endpoint_retired`). Use
   * `templates.upsert(channel, messageType, content, { profileId })`.
   */
  updateTemplate(
    profileId: string,
    channel: TemplateChannel,
    type: TemplateMessageType,
    params: ProfileTemplateUpdateParams,
  ): Promise<ProfileTemplate> {
    return this.http.put<ProfileTemplate>(
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}/templates/${encodeURIComponent(channel)}/${encodeURIComponent(type)}`,
      params,
    );
  }

  /**
   * Delete a profile template (resets to default)
   *
   * @deprecated The server retired this route (410 `endpoint_retired`). Use
   * `templates.delete(channel, messageType, { profileId })`.
   */
  deleteTemplate(
    profileId: string,
    channel: TemplateChannel,
    type: TemplateMessageType,
  ): Promise<ProfileTemplate> {
    return this.http.del<ProfileTemplate>(
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}/templates/${encodeURIComponent(channel)}/${encodeURIComponent(type)}`,
    );
  }

  /**
   * Preview a profile template with the profile's branding
   *
   * @deprecated The server retired this route (410 `endpoint_retired`). Use
   * `templates.preview(params, { profileId })`.
   */
  previewTemplate(
    profileId: string,
    params: ProfileTemplatePreviewParams,
  ): Promise<ProfileTemplatePreviewResponse> {
    return this.http.post<ProfileTemplatePreviewResponse>(
      `/api/v1/me/profiles/${encodeURIComponent(profileId)}/templates/preview`,
      params,
    );
  }
}
