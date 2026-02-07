/**
 * Authentication-related type definitions
 */

export type UserRole = 'platform_admin' | 'tenant_admin' | 'tenant_member';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  subdomain?: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface OAuthProvider {
  id: 'google' | 'github';
  name: string;
  icon: string;
}

export interface MfaSession {
  email: string;
}

export interface MfaSetupResponse {
  qrCode: string;
  secret: string;
}

export interface MfaVerifyRequest {
  email: string;
  totpCode: string;
}
