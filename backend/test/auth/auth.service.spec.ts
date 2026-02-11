import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/audit/audit.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock('bcrypt');
jest.mock('speakeasy');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------
const createMockUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'user-uuid-1',
  email: 'admin@aegis.ai',
  name: 'Admin User',
  password: '$2b$10$hashedpassword',
  role: 'platform_admin',
  tenantId: null,
  mfaEnabled: false,
  mfaSecret: null,
  oauthProvider: null,
  oauthId: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createMockTenantUser = (overrides: Partial<Record<string, unknown>> = {}) =>
  createMockUser({
    id: 'user-uuid-2',
    email: 'user@company.com',
    name: 'Tenant User',
    role: 'tenant_admin',
    tenantId: 'tenant-uuid-1',
    ...overrides,
  });

const createMockRefreshTokenRecord = (
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'rt-uuid-1',
  token: 'valid-refresh-token',
  userId: 'user-uuid-1',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  revokedAt: null,
  createdAt: new Date(),
  user: createMockUser(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: AuthService
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    // Create fresh mocks for every test to prevent cross-contamination
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '7d',
          GOOGLE_CLIENT_ID: 'google-client-id',
          GOOGLE_CLIENT_SECRET: 'google-client-secret',
          GITHUB_CLIENT_ID: 'github-client-id',
          GITHUB_CLIENT_SECRET: 'github-client-secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        {
          provide: AuditService,
          useValue: { logAction: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // POST /api/auth/login
  // =========================================================================
  describe('login', () => {
    it('should return tokens and user for valid credentials', async () => {
      // Arrange
      const user = createMockUser({ mfaEnabled: false });
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue(user);
      jwtService.sign
        .mockReturnValueOnce('access-token-123')
        .mockReturnValueOnce('refresh-token-456');

      // Act
      const result = await service.login({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      // Assert - matches API contract Section 1 Login response
      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        expiresIn: 900, // 15 minutes as per contract
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: undefined,
        },
      });
    });

    it('should return tenantId for tenant users', async () => {
      // Arrange
      const user = createMockTenantUser();
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue(user);

      // Act
      const result = await service.login({
        email: user.email,
        password: 'ValidPass123!@',
      });

      // Assert
      expect(result).toHaveProperty('user.tenantId', 'tenant-uuid-1');
      expect(result).toHaveProperty('user.role', 'tenant_admin');
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert - contract returns 401 "Invalid credentials"
      await expect(
        service.login({ email: 'nonexistent@test.com', password: 'Password123!@' }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login({ email: 'nonexistent@test.com', password: 'Password123!@' }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      // Arrange
      const user = createMockUser();
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.login({ email: user.email, password: 'WrongPassword1!@' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return mfaRequired flag when MFA is enabled', async () => {
      // Arrange - platform admin with MFA
      const user = createMockUser({
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.login({
        email: user.email,
        password: 'ValidPass123!@',
      });

      // Assert - contract specifies MFA redirect
      expect(result).toEqual({
        mfaRequired: true,
        email: user.email,
        message: expect.stringContaining('MFA verification required'),
      });

      // Should NOT generate tokens
      expect(jwtService.sign).not.toHaveBeenCalled();
      // Should NOT store refresh token
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user has no password (OAuth-only)', async () => {
      // Arrange
      const user = createMockUser({ password: null });
      prisma.user.findUnique.mockResolvedValue(user);

      // Act & Assert
      await expect(
        service.login({ email: user.email, password: 'AnyPass123!@' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should store refresh token in database after successful login', async () => {
      // Arrange
      const user = createMockUser();
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue(user);

      // Act
      await service.login({ email: user.email, password: 'ValidPass123!@' });

      // Assert
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          token: expect.any(String),
          userId: user.id,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should update lastLoginAt after successful login', async () => {
      // Arrange
      const user = createMockUser();
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue(user);

      // Act
      await service.login({ email: user.email, password: 'ValidPass123!@' });

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  // =========================================================================
  // POST /api/auth/login/oauth
  // =========================================================================
  describe('oauthLogin', () => {
    // We cannot easily test the full OAuth flow since it involves external
    // HTTP calls. We test the findOrCreate user logic and token generation
    // by mocking the private verify methods via the service behavior.

    it('should throw BadRequestException for invalid provider', async () => {
      // Act & Assert
      await expect(
        service.oauthLogin({
          provider: 'invalid' as 'google',
          code: 'auth-code',
          redirectUri: 'http://localhost:3001/callback',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when OAuth verification fails', async () => {
      // Arrange - mock global fetch to fail
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        service.oauthLogin({
          provider: 'google',
          code: 'invalid-code',
          redirectUri: 'http://localhost:3001/callback',
        }),
      ).rejects.toThrow(BadRequestException);

      global.fetch = originalFetch;
    });

    it('should throw BadRequestException when Google OAuth is not configured', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return undefined;
        if (key === 'GOOGLE_CLIENT_SECRET') return undefined;
        return 'some-value';
      });

      // Need to recreate the service with the updated config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: prisma },
          { provide: JwtService, useValue: jwtService },
          { provide: ConfigService, useValue: configService },
          { provide: AuditService, useValue: { logAction: jest.fn() } },
        ],
      }).compile();

      const svc = module.get<AuthService>(AuthService);

      // Act & Assert
      await expect(
        svc.oauthLogin({
          provider: 'google',
          code: 'auth-code',
          redirectUri: 'http://localhost:3001/callback',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // POST /api/auth/refresh
  // =========================================================================
  describe('refreshToken', () => {
    it('should return new accessToken and expiresIn for valid refresh token', async () => {
      // Arrange
      const storedToken = createMockRefreshTokenRecord();
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      jwtService.sign.mockReturnValue('new-access-token');

      // Act
      const result = await service.refreshToken({
        refreshToken: 'valid-refresh-token',
      });

      // Assert - contract: { accessToken, expiresIn }
      expect(result).toEqual({
        accessToken: 'new-access-token',
        expiresIn: 900,
      });
    });

    it('should throw UnauthorizedException for non-existent refresh token', async () => {
      // Arrange
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.refreshToken({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.refreshToken({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      // Arrange
      const revokedToken = createMockRefreshTokenRecord({
        revokedAt: new Date(),
      });
      prisma.refreshToken.findUnique.mockResolvedValue(revokedToken);

      // Act & Assert
      await expect(
        service.refreshToken({ refreshToken: 'valid-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token and cleanup', async () => {
      // Arrange
      const expiredToken = createMockRefreshTokenRecord({
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });
      prisma.refreshToken.findUnique.mockResolvedValue(expiredToken);
      prisma.refreshToken.delete.mockResolvedValue({});

      // Act & Assert
      await expect(
        service.refreshToken({ refreshToken: 'valid-refresh-token' }),
      ).rejects.toThrow(UnauthorizedException);

      // Should clean up expired token
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: expiredToken.id },
      });
    });

    it('should include correct JWT payload with permissions', async () => {
      // Arrange
      const storedToken = createMockRefreshTokenRecord();
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);

      // Act
      await service.refreshToken({ refreshToken: 'valid-refresh-token' });

      // Assert - verify JwtService.sign was called with correct payload
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
          permissions: expect.any(Array),
        }),
      );
    });
  });

  // =========================================================================
  // POST /api/auth/logout
  // =========================================================================
  describe('logout', () => {
    it('should revoke refresh token by setting revokedAt', async () => {
      // Arrange
      const storedToken = createMockRefreshTokenRecord();
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({});

      // Act
      await service.logout({ refreshToken: 'valid-refresh-token' });

      // Assert
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: storedToken.id },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should not throw when refresh token does not exist (idempotent)', async () => {
      // Arrange
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      // Act & Assert - should not throw
      await expect(
        service.logout({ refreshToken: 'nonexistent-token' }),
      ).resolves.toBeUndefined();

      // Should not attempt to update
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // POST /api/auth/mfa/verify
  // =========================================================================
  describe('verifyMfa', () => {
    it('should return tokens and user after valid TOTP verification', async () => {
      // Arrange
      const user = createMockUser({
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        role: 'platform_admin',
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue(user);
      jwtService.sign
        .mockReturnValueOnce('mfa-access-token')
        .mockReturnValueOnce('mfa-refresh-token');

      // Act
      const result = await service.verifyMfa({
        email: user.email,
        totpCode: '123456',
      });

      // Assert - contract MFA verify response
      expect(result).toEqual({
        accessToken: 'mfa-access-token',
        refreshToken: 'mfa-refresh-token',
        expiresIn: 900,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: 'platform_admin',
          mfaEnabled: true,
        },
      });
    });

    it('should throw UnauthorizedException for invalid TOTP code', async () => {
      // Arrange
      const user = createMockUser({
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      // Act & Assert - contract: 401 "Invalid MFA code"
      await expect(
        service.verifyMfa({ email: user.email, totpCode: '000000' }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.verifyMfa({ email: user.email, totpCode: '000000' }),
      ).rejects.toThrow('Invalid MFA code');
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.verifyMfa({ email: 'nobody@test.com', totpCode: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when MFA is not enabled on user', async () => {
      // Arrange
      const user = createMockUser({ mfaEnabled: false, mfaSecret: null });
      prisma.user.findUnique.mockResolvedValue(user);

      // Act & Assert
      await expect(
        service.verifyMfa({ email: user.email, totpCode: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should verify TOTP with correct parameters', async () => {
      // Arrange
      const user = createMockUser({
        mfaEnabled: true,
        mfaSecret: 'JBSWY3DPEHPK3PXP',
      });
      prisma.user.findUnique.mockResolvedValue(user);
      (mockedSpeakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue(user);

      // Act
      await service.verifyMfa({ email: user.email, totpCode: '123456' });

      // Assert - verify speakeasy was called with correct params
      expect(mockedSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        encoding: 'base32',
        token: '123456',
        window: 1,
      });
    });
  });

  // =========================================================================
  // GET /api/auth/me
  // =========================================================================
  describe('getCurrentUser', () => {
    it('should return user profile with permissions for platform_admin', async () => {
      // Arrange
      const user = createMockUser();
      prisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await service.getCurrentUser(user.id);

      // Assert - contract: { id, email, name, role, tenantId?, permissions, createdAt }
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'platform_admin',
        tenantId: undefined,
        permissions: expect.arrayContaining([
          'admin:dashboard:read',
          'admin:tenants:read',
          'admin:tenants:write',
        ]),
        createdAt: user.createdAt.toISOString(),
      });
    });

    it('should return user profile with permissions for tenant_admin', async () => {
      // Arrange
      const user = createMockTenantUser({ role: 'tenant_admin' });
      prisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await service.getCurrentUser(user.id);

      // Assert
      expect(result).toHaveProperty('role', 'tenant_admin');
      expect(result).toHaveProperty('tenantId', 'tenant-uuid-1');
      expect(result.permissions).toContain('dashboard:read');
      expect(result.permissions).toContain('agents:write');
      expect(result.permissions).toContain('team:invite');
    });

    it('should return user profile with permissions for tenant_member', async () => {
      // Arrange
      const user = createMockTenantUser({ role: 'tenant_member' });
      prisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await service.getCurrentUser(user.id);

      // Assert
      expect(result).toHaveProperty('role', 'tenant_member');
      expect(result.permissions).toContain('dashboard:read');
      expect(result.permissions).toContain('agents:read');
      // tenant_member should NOT have write permissions
      expect(result.permissions).not.toContain('agents:write');
      expect(result.permissions).not.toContain('team:invite');
      expect(result.permissions).not.toContain('settings:write');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getCurrentUser('nonexistent-uuid'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return createdAt as ISO 8601 string', async () => {
      // Arrange
      const user = createMockUser({
        createdAt: new Date('2026-01-15T10:30:00.000Z'),
      });
      prisma.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await service.getCurrentUser(user.id);

      // Assert - contract specifies ISO 8601
      expect(result.createdAt).toBe('2026-01-15T10:30:00.000Z');
    });
  });

  // =========================================================================
  // Helper: getPermissionsForRole
  // =========================================================================
  describe('permissions per role', () => {
    it('should return platform_admin permissions from getCurrentUser', async () => {
      const user = createMockUser({ role: 'platform_admin' });
      prisma.user.findUnique.mockResolvedValue(user);
      const result = await service.getCurrentUser(user.id);

      expect(result.permissions).toEqual(
        expect.arrayContaining([
          'admin:dashboard:read',
          'admin:tenants:read',
          'admin:tenants:write',
          'admin:tenants:delete',
          'admin:skills:read',
          'admin:skills:review',
          'admin:alerts:read',
        ]),
      );
    });

    it('should return empty permissions for unknown role', async () => {
      const user = createMockUser({ role: 'unknown_role' });
      prisma.user.findUnique.mockResolvedValue(user);
      const result = await service.getCurrentUser(user.id);

      expect(result.permissions).toEqual([]);
    });
  });
});
