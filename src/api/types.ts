// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  status?: number;
}

// Auth Types
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  turnstile_token?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  turnstile_token?: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface LogoutResponse {
  revoked_count: number;
}

// Session Types
export interface Session {
  session_id: string;
  device_info: string;
  ip_address: string;
  created_at: string;
  last_used_at: string;
  is_current: boolean;
}

export interface SessionsResponse {
  current_session_id: string;
  sessions: Session[];
}

export interface RevokeSessionRequest {
  password: string;
}

// User Data Types
export interface SetSecurityPasswordRequest {
  password: string;
}

export interface UpdateSecurityPasswordRequest {
  old_password: string;
  new_password: string;
}

export interface SecurityPasswordStatusResponse {
  has_security_password: boolean;
}

export interface GetUserDataRequest {
  password?: string;
}

export interface UserDataResponse {
  data: any;
  is_encrypted: boolean;
}

export interface UpdateUserDataRequest {
  password?: string;
  data: any;
}

// Share Types
export type ShareType = 'realtime' | 'copy';

export interface CreateShareRequest {
  share_type: ShareType;
  password?: string;
  security_password?: string;
  max_attempts?: number;
}

export interface CreateShareResponse {
  share_id: string;
  share_type: ShareType;
}

export interface Share {
  share_id: string;
  share_type: ShareType;
  has_password: boolean;
  view_count: number;
  attempt_count: number;
  max_attempts: number;
  is_locked: boolean;
  created_at: string;
}

export interface UpdateSharePasswordRequest {
  password: string;
}

export interface UpdateShareLockRequest {
  max_attempts: number;
}

export interface ViewShareRequest {
  password?: string;
}

export interface ViewShareResponse {
  data: any;
  share_type: ShareType;
}

// Avatar Types
export interface UploadAvatarResponse {
  avatar: string;
  original_size: number;
  final_size: number;
  compressed: boolean;
}

// Password Management Types
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message: string;
  other_sessions_logged_out: number;
}

// Statistics Types
export interface StatisticsResponse {
  total_users: number;
  syncs_last_7_days: number;
  database_size: string;
  last_updated: string;
}
