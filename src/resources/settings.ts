import type { HttpClient } from '../http.js';
import type {
  UserSettings,
  UpdateSettingsParams,
  UsageResponse,
  ExportResponse,
  ListUsageParams,
} from '../types.js';

export class Settings {
  constructor(private readonly http: HttpClient) {}

  /** Get user settings */
  get(): Promise<UserSettings> {
    return this.http.get<UserSettings>('/api/v1/me/settings');
  }

  /** Update user settings */
  update(params: UpdateSettingsParams): Promise<UserSettings> {
    return this.http.patch<UserSettings>('/api/v1/me/settings', params);
  }

  /** Get usage metrics */
  getUsage(params?: ListUsageParams): Promise<UsageResponse> {
    const query: Record<string, string> = {};
    if (params?.period) query['period'] = params.period;
    if (params?.months != null) query['months'] = String(params.months);
    const hasQuery = Object.keys(query).length > 0;
    return this.http.get<UsageResponse>('/api/v1/me/usage', hasQuery ? query : undefined);
  }

  /** Export user data (GDPR) */
  export(): Promise<ExportResponse> {
    return this.http.get<ExportResponse>('/api/v1/me/export');
  }
}
