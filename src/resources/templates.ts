import type { HttpClient } from '../http.js';
import type {
  TemplateChannel,
  TemplateMessageType,
  TemplateContent,
  TemplateProjectOptions,
  TemplateListResponse,
  TemplateDefaultsResponse,
  TemplateGetResponse,
  TemplateUpsertResponse,
  TemplateDeleteResponse,
  TemplatePreviewParams,
  TemplatePreviewResponse,
  TemplateRenderParams,
  TemplateRenderResponse,
} from '../types.js';

/** The `profile_id` query naming the sub-account, or nothing when the caller named none. */
function projectQuery(options?: TemplateProjectOptions): { profile_id: string } | undefined {
  return options?.profileId === undefined ? undefined : { profile_id: options.profileId };
}

/**
 * Message templates. Templates exist per sub-account only: every method but
 * `getDefaults` takes an optional `{ profileId }` naming the sub-account, sent as `profile_id`.
 */
export class Templates {
  constructor(private readonly http: HttpClient) {}

  /** List the sub-account's custom templates plus available channels, message types, and variables */
  list(options?: TemplateProjectOptions): Promise<TemplateListResponse> {
    return this.http.get<TemplateListResponse>('/api/v1/templates', projectQuery(options));
  }

  /** Get all default templates (for reference) */
  getDefaults(): Promise<TemplateDefaultsResponse> {
    return this.http.get<TemplateDefaultsResponse>('/api/v1/templates/defaults');
  }

  /** Get a specific template (the sub-account's own if set, default otherwise) */
  retrieve(channel: TemplateChannel, messageType: TemplateMessageType, options?: TemplateProjectOptions): Promise<TemplateGetResponse> {
    return this.http.get<TemplateGetResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      projectQuery(options),
    );
  }

  /** Create or update the sub-account's custom template */
  upsert(
    channel: TemplateChannel,
    messageType: TemplateMessageType,
    content: TemplateContent,
    options?: TemplateProjectOptions,
  ): Promise<TemplateUpsertResponse> {
    return this.http.request<TemplateUpsertResponse>(
      'PUT',
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      { body: content, query: projectQuery(options) },
    );
  }

  /** Delete the sub-account's custom template (resets to default; 404 if no custom template exists) */
  delete(channel: TemplateChannel, messageType: TemplateMessageType, options?: TemplateProjectOptions): Promise<TemplateDeleteResponse> {
    return this.http.request<TemplateDeleteResponse>(
      'DELETE',
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      { query: projectQuery(options) },
    );
  }

  /** Preview a template with sample data and the sub-account's branding */
  preview(params: TemplatePreviewParams, options?: TemplateProjectOptions): Promise<TemplatePreviewResponse> {
    return this.http.request<TemplatePreviewResponse>(
      'POST',
      '/api/v1/templates/preview',
      { body: params, query: projectQuery(options) },
    );
  }

  /** Render the sub-account's template with provided variables (for testing) */
  render(params: TemplateRenderParams, options?: TemplateProjectOptions): Promise<TemplateRenderResponse> {
    return this.http.request<TemplateRenderResponse>(
      'POST',
      '/api/v1/templates/render',
      { body: params, query: projectQuery(options) },
    );
  }
}
