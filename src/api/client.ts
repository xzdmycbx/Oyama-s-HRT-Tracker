import type {
  ApiResponse,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  SessionsResponse,
  RevokeSessionRequest,
  SetSecurityPasswordRequest,
  UpdateSecurityPasswordRequest,
  SecurityPasswordStatusResponse,
  GetUserDataRequest,
  UserDataResponse,
  UpdateUserDataRequest,
  CreateShareRequest,
  CreateShareResponse,
  Share,
  UpdateSharePasswordRequest,
  UpdateShareLockRequest,
  ViewShareRequest,
  ViewShareResponse,
  CreateAuthorizationRequest,
  CreateAuthorizationResponse,
  Authorization,
  ViewAuthorizedDataRequest,
  ViewAuthorizedDataResponse,
  UploadAvatarResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
} from './types';

import { API_BASE_URL } from './config';

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshTokenCallback: (() => Promise<boolean>) | null = null;
  private isRefreshing: boolean = false;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setRefreshTokenCallback(callback: () => Promise<boolean>) {
    this.refreshTokenCallback = callback;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout: number = 30000
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Public endpoints that don't need Authorization
    const publicEndpoints = ['/auth/login', '/auth/register', '/auth/refresh', '/health'];
    const needsAuth = !publicEndpoints.some(ep => endpoint.startsWith(ep)) &&
                      !endpoint.match(/^\/shares\/[^/]+\/view$/); // /shares/:id/view is also public

    if (this.accessToken && needsAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle empty responses (like 204 No Content)
      let data: any;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        // CRITICAL FIX: Don't auto-retry 401 if this is a security password verification
        // Only /user/data (GET/POST) and /user/data (PUT) with password param can return 401 for wrong password
        // Other 401s are token expiry and should trigger refresh
        const bodyHasPassword =
          typeof options.body === 'string' && /"password"|"_password"/.test(options.body);

        const isSecurityPasswordRequest =
          (endpoint === '/user/data' || endpoint.startsWith('/user/data?')) && bodyHasPassword;

        // Handle 401 Unauthorized - try to refresh token
        // BUT: if this is a password-related request, DON'T refresh
        if (response.status === 401 &&
            this.refreshTokenCallback &&
            !this.isRefreshing &&
            !publicEndpoints.some(ep => endpoint.startsWith(ep)) &&
            !isSecurityPasswordRequest &&
            !bodyHasPassword) { // Skip auto-retry for password verification
          this.isRefreshing = true;
          const refreshed = await this.refreshTokenCallback();
          this.isRefreshing = false;

          if (refreshed) {
            // Retry the request with new token
            return this.request<T>(endpoint, options, timeout);
          }
        }

        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Request timeout',
          };
        }
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Network error',
      };
    }
  }

  // Auth APIs
  async register(data: RegisterRequest): Promise<ApiResponse<AuthTokens>> {
    return this.request<AuthTokens>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<ApiResponse<AuthTokens>> {
    return this.request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refreshToken(data: RefreshTokenRequest): Promise<ApiResponse<AuthTokens>> {
    return this.request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSessions(): Promise<ApiResponse<SessionsResponse>> {
    return this.request<SessionsResponse>('/auth/sessions');
  }

  async revokeSession(sessionId: string, data: RevokeSessionRequest): Promise<ApiResponse<void>> {
    return this.request<void>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  async revokeAllOtherSessions(data: RevokeSessionRequest): Promise<ApiResponse<{ revoked_count: number }>> {
    return this.request<{ revoked_count: number }>('/auth/sessions', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  // User Data APIs
  async setSecurityPassword(data: SetSecurityPasswordRequest): Promise<ApiResponse<void>> {
    return this.request<void>('/user/security-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSecurityPassword(data: UpdateSecurityPasswordRequest): Promise<ApiResponse<void>> {
    return this.request<void>('/user/security-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getSecurityPasswordStatus(): Promise<ApiResponse<SecurityPasswordStatusResponse>> {
    return this.request<SecurityPasswordStatusResponse>('/user/security-password/status');
  }

  async getUserData(data?: GetUserDataRequest): Promise<ApiResponse<UserDataResponse>> {
    return this.request<UserDataResponse>('/user/data', {
      method: 'POST',
      body: data ? JSON.stringify(data) : JSON.stringify({}),
    });
  }

  async updateUserData(data: UpdateUserDataRequest): Promise<ApiResponse<void>> {
    return this.request<void>('/user/data', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Share APIs
  async createShare(data: CreateShareRequest): Promise<ApiResponse<CreateShareResponse>> {
    return this.request<CreateShareResponse>('/shares', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getShares(): Promise<ApiResponse<Share[]>> {
    return this.request<Share[]>('/shares');
  }

  async deleteShare(shareId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async updateSharePassword(shareId: string, data: UpdateSharePasswordRequest): Promise<ApiResponse<void>> {
    return this.request<void>(`/shares/${shareId}/password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateShareLock(shareId: string, data: UpdateShareLockRequest): Promise<ApiResponse<void>> {
    return this.request<void>(`/shares/${shareId}/lock`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async viewShare(shareId: string, data?: ViewShareRequest): Promise<ApiResponse<ViewShareResponse>> {
    return this.request<ViewShareResponse>(`/shares/${shareId}/view`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : JSON.stringify({}),
    });
  }

  // Authorization APIs
  async createAuthorization(data: CreateAuthorizationRequest): Promise<ApiResponse<CreateAuthorizationResponse>> {
    return this.request<CreateAuthorizationResponse>('/authorizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeAuthorization(viewerUsername: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/authorizations/${viewerUsername}`, {
      method: 'DELETE',
    });
  }

  async getGrantedAuthorizations(): Promise<ApiResponse<Authorization[]>> {
    return this.request<Authorization[]>('/authorizations/granted');
  }

  async getReceivedAuthorizations(): Promise<ApiResponse<Authorization[]>> {
    return this.request<Authorization[]>('/authorizations/received');
  }

  async viewAuthorizedData(data: ViewAuthorizedDataRequest): Promise<ApiResponse<ViewAuthorizedDataResponse>> {
    return this.request<ViewAuthorizedDataResponse>('/authorizations/view', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Avatar APIs
  async uploadAvatar(file: File): Promise<ApiResponse<UploadAvatarResponse>> {
    const formData = new FormData();
    formData.append('avatar', file);

    const url = `${this.baseUrl}/user/avatar`;
    const headers: HeadersInit = {};

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      let data: any;
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Network error',
      };
    }
  }

  async deleteAvatar(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/user/avatar', {
      method: 'DELETE',
    });
  }

  getAvatarUrl(username: string): string {
    return `${this.baseUrl}/avatars/${username}`;
  }

  // Password Management APIs
  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse<ChangePasswordResponse>> {
    return this.request<ChangePasswordResponse>('/user/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request<{ status: string }>('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
