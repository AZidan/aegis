import { api } from './client';
import type { User, RegisterCredentials, MfaSetupResponse } from '@/types/auth';

/**
 * Authentication API
 * Handles all auth-related API calls
 */

// Request types
export interface LoginRequest {
  email: string;
  password: string;
  subdomain?: string;
}

export interface OAuthLoginRequest {
  provider: 'google' | 'github';
  code: string;
  redirectUri: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface MfaVerifyRequest {
  email: string;
  totpCode: string;
}

// Response types
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mfaRequired?: boolean;
  email?: string;
  message?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'platform_admin' | 'tenant_admin' | 'tenant_member';
    tenantId?: string;
  };
}

export interface RegisterResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface MfaVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'platform_admin' | 'tenant_admin' | 'tenant_member';
    tenantId?: string;
  };
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'tenant_admin' | 'tenant_member';
  tenantId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * Tenant login (email + password)
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', data);
  return response.data;
}

/**
 * Register a new user
 */
export async function register(data: RegisterCredentials): Promise<RegisterResponse> {
  const response = await api.post<RegisterResponse>('/auth/register', data);
  return response.data;
}

/**
 * OAuth login (Google or GitHub)
 */
export async function loginOAuth(data: OAuthLoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login/oauth', data);
  return response.data;
}

/**
 * Refresh access token
 */
export async function refreshToken(data: RefreshTokenRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/refresh', data);
  return response.data;
}

/**
 * Logout
 */
export async function logout(refreshTokenValue?: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken: refreshTokenValue });
}

/**
 * Request MFA setup (generates QR code + secret)
 */
export async function setupMfa(): Promise<MfaSetupResponse> {
  const response = await api.post<MfaSetupResponse>('/auth/mfa/setup');
  return response.data;
}

/**
 * Verify MFA code (TOTP)
 */
export async function verifyMfa(data: MfaVerifyRequest): Promise<MfaVerifyResponse> {
  const response = await api.post<MfaVerifyResponse>('/auth/mfa/verify', data);
  return response.data;
}

/**
 * Admin login (email + password) - platform_admin only
 */
export async function adminLogin(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/admin/auth/login', data);
  return response.data;
}

/**
 * Admin MFA verify - platform_admin only
 */
export async function adminVerifyMfa(data: MfaVerifyRequest): Promise<MfaVerifyResponse> {
  const response = await api.post<MfaVerifyResponse>('/admin/auth/mfa/verify', data);
  return response.data;
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<UserResponse> {
  const response = await api.get<UserResponse>('/auth/me');
  return response.data;
}
