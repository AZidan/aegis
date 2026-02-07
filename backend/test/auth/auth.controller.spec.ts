import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../src/common/pipes/validation.pipe';
import { loginSchema } from '../../src/auth/dto/login.dto';
import { oauthLoginSchema } from '../../src/auth/dto/oauth-login.dto';
import { refreshTokenSchema, logoutSchema } from '../../src/auth/dto/refresh-token.dto';
import { mfaVerifySchema } from '../../src/auth/dto/mfa-verify.dto';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
const mockLoginResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
  user: {
    id: 'user-uuid',
    email: 'admin@aegis.ai',
    name: 'Admin User',
    role: 'platform_admin' as const,
    tenantId: undefined,
  },
};

const mockRefreshResponse = {
  accessToken: 'new-access-token',
  expiresIn: 900,
};

const mockMfaResponse = {
  accessToken: 'mfa-access-token',
  refreshToken: 'mfa-refresh-token',
  expiresIn: 900,
  user: {
    id: 'user-uuid',
    email: 'admin@aegis.ai',
    name: 'Admin User',
    role: 'platform_admin' as const,
    mfaEnabled: true,
  },
};

const mockCurrentUser = {
  id: 'user-uuid',
  email: 'admin@aegis.ai',
  name: 'Admin User',
  role: 'platform_admin',
  permissions: ['admin:dashboard:read', 'admin:tenants:read'],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Test Suite: AuthController
// ---------------------------------------------------------------------------
describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    oauthLogin: jest.Mock;
    refreshToken: jest.Mock;
    logout: jest.Mock;
    verifyMfa: jest.Mock;
    getCurrentUser: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      oauthLogin: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      verifyMfa: jest.fn(),
      getCurrentUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
      ],
    })
      // Override the JwtAuthGuard to always pass for controller unit tests
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  // =========================================================================
  // POST /api/auth/login
  // =========================================================================
  describe('POST /auth/login', () => {
    it('should return login response with tokens and user', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });
    });

    it('should return MFA required response when MFA is enabled', async () => {
      // Arrange
      const mfaRequiredResponse = {
        mfaRequired: true,
        email: 'admin@aegis.ai',
        message: 'MFA verification required.',
      };
      authService.login.mockResolvedValue(mfaRequiredResponse);

      // Act
      const result = await controller.login({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      // Assert
      expect(result).toHaveProperty('mfaRequired', true);
    });

    it('should propagate UnauthorizedException from service', async () => {
      // Arrange
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      // Act & Assert
      await expect(
        controller.login({ email: 'bad@test.com', password: 'WrongPass123!@' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // POST /api/auth/login/oauth
  // =========================================================================
  describe('POST /auth/login/oauth', () => {
    it('should return login response for valid OAuth request', async () => {
      // Arrange
      authService.oauthLogin.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.oauthLogin({
        provider: 'google',
        code: 'valid-auth-code',
        redirectUri: 'http://localhost:3001/callback',
      });

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.oauthLogin).toHaveBeenCalledWith({
        provider: 'google',
        code: 'valid-auth-code',
        redirectUri: 'http://localhost:3001/callback',
      });
    });

    it('should accept github as a valid provider', async () => {
      // Arrange
      authService.oauthLogin.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.oauthLogin({
        provider: 'github',
        code: 'github-code',
        redirectUri: 'http://localhost:3001/callback',
      });

      // Assert
      expect(result).toBeDefined();
      expect(authService.oauthLogin).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'github' }),
      );
    });
  });

  // =========================================================================
  // POST /api/auth/refresh
  // =========================================================================
  describe('POST /auth/refresh', () => {
    it('should return new access token', async () => {
      // Arrange
      authService.refreshToken.mockResolvedValue(mockRefreshResponse);

      // Act
      const result = await controller.refresh({
        refreshToken: 'valid-refresh-token',
      });

      // Assert - contract: { accessToken, expiresIn }
      expect(result).toEqual({
        accessToken: 'new-access-token',
        expiresIn: 900,
      });
    });

    it('should propagate UnauthorizedException for invalid refresh token', async () => {
      // Arrange
      authService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Invalid or expired refresh token'),
      );

      // Act & Assert
      await expect(
        controller.refresh({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // POST /api/auth/logout
  // =========================================================================
  describe('POST /auth/logout', () => {
    it('should call logout service and return void (204 No Content)', async () => {
      // Arrange
      authService.logout.mockResolvedValue(undefined);

      // Act
      const result = await controller.logout({
        refreshToken: 'valid-refresh-token',
      });

      // Assert - controller returns void (HttpCode 204 is set via decorator)
      expect(result).toBeUndefined();
      expect(authService.logout).toHaveBeenCalledWith({
        refreshToken: 'valid-refresh-token',
      });
    });
  });

  // =========================================================================
  // POST /api/auth/mfa/verify
  // =========================================================================
  describe('POST /auth/mfa/verify', () => {
    it('should return tokens and user after valid MFA verification', async () => {
      // Arrange
      authService.verifyMfa.mockResolvedValue(mockMfaResponse);

      // Act
      const result = await controller.verifyMfa({
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });

      // Assert
      expect(result).toEqual(mockMfaResponse);
      expect(result.user.mfaEnabled).toBe(true);
    });

    it('should propagate UnauthorizedException for invalid MFA code', async () => {
      // Arrange
      authService.verifyMfa.mockRejectedValue(
        new UnauthorizedException('Invalid MFA code'),
      );

      // Act & Assert
      await expect(
        controller.verifyMfa({ email: 'admin@aegis.ai', totpCode: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // GET /api/auth/me
  // =========================================================================
  describe('GET /auth/me', () => {
    it('should return current user profile with permissions', async () => {
      // Arrange
      authService.getCurrentUser.mockResolvedValue(mockCurrentUser);

      // Act
      const result = await controller.getCurrentUser('user-uuid');

      // Assert - contract: { id, email, name, role, permissions, createdAt }
      expect(result).toEqual(mockCurrentUser);
      expect(authService.getCurrentUser).toHaveBeenCalledWith('user-uuid');
    });

    it('should propagate UnauthorizedException when user not found', async () => {
      // Arrange
      authService.getCurrentUser.mockRejectedValue(
        new UnauthorizedException('User not found'),
      );

      // Act & Assert
      await expect(
        controller.getCurrentUser('nonexistent-uuid'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // DTO Validation (ZodValidationPipe)
  // =========================================================================
  describe('DTO Validation', () => {
    describe('loginSchema', () => {
      const pipe = new ZodValidationPipe(loginSchema);

      it('should pass valid login data', () => {
        const result = pipe.transform({
          email: 'user@example.com',
          password: 'ValidPass123!@',
        });
        expect(result).toEqual({
          email: 'user@example.com',
          password: 'ValidPass123!@',
        });
      });

      it('should reject invalid email format', () => {
        expect(() =>
          pipe.transform({ email: 'not-an-email', password: 'ValidPass123!@' }),
        ).toThrow();
      });

      it('should reject empty email', () => {
        expect(() =>
          pipe.transform({ email: '', password: 'ValidPass123!@' }),
        ).toThrow();
      });

      it('should reject password shorter than 12 characters', () => {
        expect(() =>
          pipe.transform({ email: 'user@example.com', password: 'Short1!' }),
        ).toThrow();
      });

      it('should reject missing email field', () => {
        expect(() =>
          pipe.transform({ password: 'ValidPass123!@' }),
        ).toThrow();
      });

      it('should reject missing password field', () => {
        expect(() =>
          pipe.transform({ email: 'user@example.com' }),
        ).toThrow();
      });
    });

    describe('oauthLoginSchema', () => {
      const pipe = new ZodValidationPipe(oauthLoginSchema);

      it('should pass valid OAuth login data with google provider', () => {
        const result = pipe.transform({
          provider: 'google',
          code: 'auth-code-123',
          redirectUri: 'http://localhost:3001/callback',
        }) as any;
        expect(result.provider).toBe('google');
      });

      it('should pass valid OAuth login data with github provider', () => {
        const result = pipe.transform({
          provider: 'github',
          code: 'auth-code-123',
          redirectUri: 'http://localhost:3001/callback',
        }) as any;
        expect(result.provider).toBe('github');
      });

      it('should reject invalid provider', () => {
        expect(() =>
          pipe.transform({
            provider: 'facebook',
            code: 'auth-code',
            redirectUri: 'http://localhost:3001/callback',
          }),
        ).toThrow();
      });

      it('should reject invalid redirect URI', () => {
        expect(() =>
          pipe.transform({
            provider: 'google',
            code: 'auth-code',
            redirectUri: 'not-a-url',
          }),
        ).toThrow();
      });

      it('should reject empty authorization code', () => {
        expect(() =>
          pipe.transform({
            provider: 'google',
            code: '',
            redirectUri: 'http://localhost:3001/callback',
          }),
        ).toThrow();
      });
    });

    describe('refreshTokenSchema', () => {
      const pipe = new ZodValidationPipe(refreshTokenSchema);

      it('should pass valid refresh token', () => {
        const result = pipe.transform({ refreshToken: 'valid-token-string' }) as any;
        expect(result.refreshToken).toBe('valid-token-string');
      });

      it('should reject empty refresh token', () => {
        expect(() => pipe.transform({ refreshToken: '' })).toThrow();
      });

      it('should reject missing refresh token', () => {
        expect(() => pipe.transform({})).toThrow();
      });
    });

    describe('logoutSchema', () => {
      const pipe = new ZodValidationPipe(logoutSchema);

      it('should pass valid logout data', () => {
        const result = pipe.transform({ refreshToken: 'token-to-revoke' }) as any;
        expect(result.refreshToken).toBe('token-to-revoke');
      });

      it('should reject empty refresh token', () => {
        expect(() => pipe.transform({ refreshToken: '' })).toThrow();
      });
    });

    describe('mfaVerifySchema', () => {
      const pipe = new ZodValidationPipe(mfaVerifySchema);

      it('should pass valid 6-digit TOTP code', () => {
        const result = pipe.transform({
          email: 'admin@aegis.ai',
          totpCode: '123456',
        }) as any;
        expect(result.totpCode).toBe('123456');
      });

      it('should reject TOTP code with non-numeric characters', () => {
        expect(() =>
          pipe.transform({ email: 'admin@aegis.ai', totpCode: '12345a' }),
        ).toThrow();
      });

      it('should reject TOTP code shorter than 6 digits', () => {
        expect(() =>
          pipe.transform({ email: 'admin@aegis.ai', totpCode: '12345' }),
        ).toThrow();
      });

      it('should reject TOTP code longer than 6 digits', () => {
        expect(() =>
          pipe.transform({ email: 'admin@aegis.ai', totpCode: '1234567' }),
        ).toThrow();
      });

      it('should reject invalid email in MFA verify', () => {
        expect(() =>
          pipe.transform({ email: 'not-email', totpCode: '123456' }),
        ).toThrow();
      });
    });
  });

  // =========================================================================
  // Guard Configuration Verification
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard on GET /auth/me', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.getCurrentUser);
      expect(guards).toBeDefined();
      // Verify JwtAuthGuard is configured (may be overridden in tests)
      expect(guards?.length).toBeGreaterThan(0);
    });

    it('should have JwtAuthGuard on POST /auth/logout', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.logout);
      expect(guards).toBeDefined();
      expect(guards?.length).toBeGreaterThan(0);
    });

    it('should NOT have JwtAuthGuard on POST /auth/login', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.login);
      // Login is a public endpoint - should have no guards or undefined
      expect(guards).toBeUndefined();
    });

    it('should NOT have JwtAuthGuard on POST /auth/mfa/verify', () => {
      const guards = Reflect.getMetadata('__guards__', AuthController.prototype.verifyMfa);
      expect(guards).toBeUndefined();
    });
  });

  // =========================================================================
  // HTTP Status Code Configuration
  // =========================================================================
  describe('HTTP Status Code Configuration', () => {
    it('should configure 200 OK for POST /auth/login', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.login,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for POST /auth/login/oauth', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.oauthLogin,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for POST /auth/refresh', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.refresh,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 204 NO_CONTENT for POST /auth/logout', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.logout,
      );
      expect(statusCode).toBe(HttpStatus.NO_CONTENT);
    });

    it('should configure 200 OK for POST /auth/mfa/verify', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.verifyMfa,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });
});
