import {
  login,
  register,
  loginOAuth,
  refreshToken,
  logout,
  verifyMfa,
  adminLogin,
  adminVerifyMfa,
  getCurrentUser,
} from '@/lib/api/auth';
import type { LoginResponse, RegisterResponse, MfaVerifyResponse, UserResponse } from '@/lib/api/auth';

// ---------------------------------------------------------------------------
// Mock the API client
// ---------------------------------------------------------------------------
const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('@/lib/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

// ---------------------------------------------------------------------------
// Test Suite: Auth API Functions
// ---------------------------------------------------------------------------
describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // POST /api/auth/login
  // =========================================================================
  describe('login', () => {
    const mockLoginResponse: LoginResponse = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
      expiresIn: 900,
      user: {
        id: 'user-uuid',
        email: 'admin@aegis.ai',
        name: 'Admin User',
        role: 'platform_admin',
      },
    };

    it('should call POST /auth/login with email and password', async () => {
      mockPost.mockResolvedValue({ data: mockLoginResponse });

      await login({ email: 'admin@aegis.ai', password: 'ValidPass123!@' });

      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });
    });

    it('should return response data directly', async () => {
      mockPost.mockResolvedValue({ data: mockLoginResponse });

      const result = await login({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      expect(result).toEqual(mockLoginResponse);
    });

    it('should propagate API errors', async () => {
      const error = {
        response: {
          status: 401,
          data: { error: 'Unauthorized', message: 'Invalid credentials' },
        },
      };
      mockPost.mockRejectedValue(error);

      await expect(
        login({ email: 'bad@test.com', password: 'WrongPass123!@' }),
      ).rejects.toEqual(error);
    });
  });

  // =========================================================================
  // POST /api/admin/auth/login
  // =========================================================================
  describe('adminLogin', () => {
    const mockAdminLoginResponse: LoginResponse = {
      accessToken: 'admin-access-token-123',
      refreshToken: 'admin-refresh-token-456',
      expiresIn: 900,
      user: {
        id: 'admin-uuid',
        email: 'admin@aegis.ai',
        name: 'Platform Admin',
        role: 'platform_admin',
      },
    };

    it('should call POST /admin/auth/login with email and password', async () => {
      mockPost.mockResolvedValue({ data: mockAdminLoginResponse });

      await adminLogin({ email: 'admin@aegis.ai', password: 'ValidPass123!@' });

      expect(mockPost).toHaveBeenCalledWith('/admin/auth/login', {
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });
    });

    it('should return response data directly', async () => {
      mockPost.mockResolvedValue({ data: mockAdminLoginResponse });

      const result = await adminLogin({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      expect(result).toEqual(mockAdminLoginResponse);
    });
  });

  // =========================================================================
  // POST /api/admin/auth/mfa/verify
  // =========================================================================
  describe('adminVerifyMfa', () => {
    const mockMfaResponse: MfaVerifyResponse = {
      accessToken: 'admin-mfa-access-token',
      refreshToken: 'admin-mfa-refresh-token',
      user: {
        id: 'admin-uuid',
        email: 'admin@aegis.ai',
        name: 'Admin',
        role: 'platform_admin',
      },
    };

    it('should call POST /admin/auth/mfa/verify with email and totpCode', async () => {
      mockPost.mockResolvedValue({ data: mockMfaResponse });

      await adminVerifyMfa({ email: 'admin@aegis.ai', totpCode: '123456' });

      expect(mockPost).toHaveBeenCalledWith('/admin/auth/mfa/verify', {
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });
    });

    it('should return tokens and user data', async () => {
      mockPost.mockResolvedValue({ data: mockMfaResponse });

      const result = await adminVerifyMfa({
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });

      expect(result.accessToken).toBe('admin-mfa-access-token');
      expect(result.user.role).toBe('platform_admin');
    });
  });

  // =========================================================================
  // POST /api/auth/register
  // =========================================================================
  describe('register', () => {
    const mockRegisterResponse: RegisterResponse = {
      user: {
        id: 'new-user-uuid',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'tenant_admin',
        createdAt: '2026-02-06T10:00:00.000Z',
      },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };

    it('should call POST /auth/register with user data', async () => {
      mockPost.mockResolvedValue({ data: mockRegisterResponse });

      await register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'ValidPass123!@',
      });

      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'ValidPass123!@',
      });
    });

    it('should return response data', async () => {
      mockPost.mockResolvedValue({ data: mockRegisterResponse });

      const result = await register({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'ValidPass123!@',
      });

      expect(result).toEqual(mockRegisterResponse);
      expect(result.user.id).toBe('new-user-uuid');
    });
  });

  // =========================================================================
  // POST /api/auth/login/oauth
  // =========================================================================
  describe('loginOAuth', () => {
    it('should call POST /auth/login/oauth with provider data', async () => {
      const mockResponse: LoginResponse = {
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        expiresIn: 900,
        user: {
          id: 'oauth-user',
          email: 'user@gmail.com',
          name: 'Google User',
          role: 'tenant_member',
        },
      };
      mockPost.mockResolvedValue({ data: mockResponse });

      await loginOAuth({
        provider: 'google',
        code: 'google-auth-code',
        redirectUri: 'http://localhost:3001/auth/callback',
      });

      expect(mockPost).toHaveBeenCalledWith('/auth/login/oauth', {
        provider: 'google',
        code: 'google-auth-code',
        redirectUri: 'http://localhost:3001/auth/callback',
      });
    });

    it('should accept github as provider', async () => {
      mockPost.mockResolvedValue({
        data: {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresIn: 900,
          user: { id: '1', email: 'a@b.com', name: 'User', role: 'tenant_member' },
        },
      });

      await loginOAuth({
        provider: 'github',
        code: 'github-auth-code',
        redirectUri: 'http://localhost:3001/auth/callback',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/auth/login/oauth',
        expect.objectContaining({ provider: 'github' }),
      );
    });
  });

  // =========================================================================
  // POST /api/auth/refresh
  // =========================================================================
  describe('refreshToken', () => {
    it('should call POST /auth/refresh with refresh token', async () => {
      mockPost.mockResolvedValue({
        data: { accessToken: 'new-access', expiresIn: 900 },
      });

      await refreshToken({ refreshToken: 'valid-refresh-token' });

      expect(mockPost).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'valid-refresh-token',
      });
    });

    it('should return new access token data', async () => {
      const responseData = {
        accessToken: 'new-access-token',
        expiresIn: 900,
      };
      mockPost.mockResolvedValue({ data: responseData });

      const result = await refreshToken({
        refreshToken: 'valid-refresh-token',
      });

      expect(result).toEqual(responseData);
    });
  });

  // =========================================================================
  // POST /api/auth/logout
  // =========================================================================
  describe('logout', () => {
    it('should call POST /auth/logout with refresh token', async () => {
      mockPost.mockResolvedValue({ data: undefined });

      await logout('refresh-token-to-revoke');

      expect(mockPost).toHaveBeenCalledWith('/auth/logout', {
        refreshToken: 'refresh-token-to-revoke',
      });
    });

    it('should handle logout without refresh token', async () => {
      mockPost.mockResolvedValue({ data: undefined });

      await logout();

      expect(mockPost).toHaveBeenCalledWith('/auth/logout', {
        refreshToken: undefined,
      });
    });
  });

  // =========================================================================
  // POST /api/auth/mfa/verify
  // =========================================================================
  describe('verifyMfa', () => {
    const mockMfaResponse: MfaVerifyResponse = {
      accessToken: 'mfa-access-token',
      refreshToken: 'mfa-refresh-token',
      user: {
        id: 'admin-uuid',
        email: 'admin@aegis.ai',
        name: 'Admin',
        role: 'platform_admin',
      },
    };

    it('should call POST /auth/mfa/verify with email and totpCode', async () => {
      mockPost.mockResolvedValue({ data: mockMfaResponse });

      await verifyMfa({ email: 'admin@aegis.ai', totpCode: '123456' });

      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/verify', {
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });
    });

    it('should return tokens and user data', async () => {
      mockPost.mockResolvedValue({ data: mockMfaResponse });

      const result = await verifyMfa({
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });

      expect(result.accessToken).toBe('mfa-access-token');
      expect(result.user.role).toBe('platform_admin');
    });
  });

  // =========================================================================
  // GET /api/auth/me
  // =========================================================================
  describe('getCurrentUser', () => {
    const mockUserResponse: UserResponse = {
      id: 'user-uuid',
      email: 'admin@aegis.ai',
      name: 'Admin User',
      role: 'platform_admin',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    it('should call GET /auth/me', async () => {
      mockGet.mockResolvedValue({ data: mockUserResponse });

      await getCurrentUser();

      expect(mockGet).toHaveBeenCalledWith('/auth/me');
    });

    it('should return user profile data', async () => {
      mockGet.mockResolvedValue({ data: mockUserResponse });

      const result = await getCurrentUser();

      expect(result).toEqual(mockUserResponse);
      expect(result.id).toBe('user-uuid');
      expect(result.role).toBe('platform_admin');
    });
  });
});
