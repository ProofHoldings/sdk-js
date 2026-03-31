import type { HttpClient } from '../http.js';
import type {
  Project,
  ProjectListResponse,
  CreateProjectParams,
  UpdateProjectParams,
  DeleteProjectResponse,
  ProjectTemplateListResponse,
  UpdateProjectTemplateParams,
  ProjectTemplateResponse,
  PreviewProjectTemplateParams,
  PreviewProjectTemplateResponse,
} from '../types.js';

export class Projects {
  constructor(private readonly http: HttpClient) {}

  /** List all projects for the authenticated user */
  list(): Promise<ProjectListResponse> {
    return this.http.get<ProjectListResponse>('/api/v1/me/projects');
  }

  /** Create a new project */
  create(params: CreateProjectParams): Promise<Project> {
    return this.http.post<Project>('/api/v1/me/projects', params);
  }

  /** Get a specific project by ID */
  retrieve(projectId: string): Promise<Project> {
    return this.http.get<Project>(`/api/v1/me/projects/${encodeURIComponent(projectId)}`);
  }

  /** Update a specific project */
  update(projectId: string, params: UpdateProjectParams): Promise<Project> {
    return this.http.put<Project>(`/api/v1/me/projects/${encodeURIComponent(projectId)}`, params);
  }

  /** Delete a project (soft delete) */
  delete(projectId: string): Promise<DeleteProjectResponse> {
    return this.http.del<DeleteProjectResponse>(`/api/v1/me/projects/${encodeURIComponent(projectId)}`);
  }

  /** List all templates for a project */
  listTemplates(projectId: string): Promise<ProjectTemplateListResponse> {
    return this.http.get<ProjectTemplateListResponse>(
      `/api/v1/me/projects/${encodeURIComponent(projectId)}/templates`,
    );
  }

  /** Update (upsert) a project template by channel and message type */
  updateTemplate(
    projectId: string,
    channel: string,
    messageType: string,
    params: UpdateProjectTemplateParams,
  ): Promise<ProjectTemplateResponse> {
    return this.http.put<ProjectTemplateResponse>(
      `/api/v1/me/projects/${encodeURIComponent(projectId)}/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
      params,
    );
  }

  /** Delete a custom project template, reverting to the default */
  deleteTemplate(
    projectId: string,
    channel: string,
    messageType: string,
  ): Promise<ProjectTemplateResponse> {
    return this.http.del<ProjectTemplateResponse>(
      `/api/v1/me/projects/${encodeURIComponent(projectId)}/templates/${encodeURIComponent(channel)}/${encodeURIComponent(messageType)}`,
    );
  }

  /** Preview a project template with sample variables */
  previewTemplate(projectId: string, params: PreviewProjectTemplateParams): Promise<PreviewProjectTemplateResponse> {
    return this.http.post<PreviewProjectTemplateResponse>(
      `/api/v1/me/projects/${encodeURIComponent(projectId)}/templates/preview`,
      params,
    );
  }
}
