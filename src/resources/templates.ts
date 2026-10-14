import type { HttpClient } from '../http.js';
import type {
  TemplateChannel,
  TemplateMessageType,
  TemplateContent,
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

export class Templates {
  constructor(private readonly http: HttpClient) {}

  /** List custom templates plus available channels, message types, and variables */
  list(): Promise<TemplateListResponse> {
    return this.http.get<TemplateListResponse>('/api/v1/templates');
  }

  /** Get all default templates (for reference) */
  getDefaults(): Promise<TemplateDefaultsResponse> {
    return this.http.get<TemplateDefaultsResponse>('/api/v1/templates/defaults');
  }

  /** Get a specific template (custom if set, default otherwise) */
  retrieve(channel: TemplateChannel, messageType: TemplateMessageType): Promise<TemplateGetResponse> {
    return this.http.get<TemplateGetResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
    );
  }

  /** Create or update a custom template */
  upsert(
    channel: TemplateChannel,
    messageType: TemplateMessageType,
    content: TemplateContent,
  ): Promise<TemplateUpsertResponse> {
    return this.http.put<TemplateUpsertResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      content,
    );
  }

  /** Delete a custom template (resets to default; 404 if no custom template exists) */
  delete(channel: TemplateChannel, messageType: TemplateMessageType): Promise<TemplateDeleteResponse> {
    return this.http.del<TemplateDeleteResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
    );
  }

  /** Preview a template with sample data */
  preview(params: TemplatePreviewParams): Promise<TemplatePreviewResponse> {
    return this.http.post<TemplatePreviewResponse>('/api/v1/templates/preview', params);
  }

  /** Render a template with provided variables (for testing) */
  render(params: TemplateRenderParams): Promise<TemplateRenderResponse> {
    return this.http.post<TemplateRenderResponse>('/api/v1/templates/render', params);
  }
}
