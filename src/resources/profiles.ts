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
  CallbackSecret,
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
   * Rotate a sub-account's callback signing secret — the secret that signs (`X-Proof-Signature`)
   * every `callback_url` delivery of that sub-account's verification requests. The new secret is
   * returned in this response only (rotation is the one way an API key obtains it) — store it now.
   * Callback deliveries already queued keep the secret they were signed with. Needs the
   * `webhooks:write` scope; a key bound to a sub-account may rotate only its own.
   */
  rotateCallbackSecret(profileId: string): Promise<CallbackSecret> {
    return this.http.post<CallbackSecret>(
      `/api/v1/profiles/profiles/${encodeURIComponent(profileId)}/callback-secret/rotate`,
    );
  }

  /**
   * List a profile's message templates (custom and default)
   *
   * @deprecated The server retired this route (410 `endpoint_retired`). Use
   * `templates.list({ profileId })`.
   * Removed in the next major — see `sdks/shared/NEXT_MAJOR.md`.
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
   * Removed in the next major — see `sdks/shared/NEXT_MAJOR.md`.
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
   * Removed in the next major — see `sdks/shared/NEXT_MAJOR.md`.
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
   * Removed in the next major — see `sdks/shared/NEXT_MAJOR.md`.
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
