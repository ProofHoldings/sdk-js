import type { HttpClient } from '../http.js';
import type {
  TemplateListResponse,
  TemplateDefaultsResponse,
  TemplateRetrieveResponse,
  UpsertTemplateParams,
  UpsertTemplateResponse,
  DeleteTemplateResponse,
  PreviewTemplateParams,
  PreviewTemplateResponse,
  RenderTemplateParams,
  RenderTemplateResponse,
} from '../types.js';

export class Templates {
  constructor(private readonly http: HttpClient) {}

  /** List all custom templates for the authenticated tenant */
  list(): Promise<TemplateListResponse> {
    return this.http.get<TemplateListResponse>('/api/v1/templates');
  }

  /** Get all default templates */
  getDefaults(): Promise<TemplateDefaultsResponse> {
    return this.http.get<TemplateDefaultsResponse>('/api/v1/templates/defaults');
  }

  /** Get a specific template (custom or default) by channel and message type */
  retrieve(channel: string, messageType: string): Promise<TemplateRetrieveResponse> {
    return this.http.get<TemplateRetrieveResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
    );
  }

  /** Create or update a custom template */
  upsert(channel: string, messageType: string, params: UpsertTemplateParams): Promise<UpsertTemplateResponse> {
    return this.http.put<UpsertTemplateResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      params,
    );
  }

  /** Delete a custom template (resets to default) */
  delete(channel: string, messageType: string): Promise<DeleteTemplateResponse> {
    return this.http.del<DeleteTemplateResponse>(
      `/api/v1/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
    );
  }

  /** Preview a template with sample data */
  preview(params: PreviewTemplateParams): Promise<PreviewTemplateResponse> {
    return this.http.post<PreviewTemplateResponse>('/api/v1/templates/preview', params);
  }

  /** Render a template with provided variables */
  render(params: RenderTemplateParams): Promise<RenderTemplateResponse> {
    return this.http.post<RenderTemplateResponse>('/api/v1/templates/render', params);
  }
}
