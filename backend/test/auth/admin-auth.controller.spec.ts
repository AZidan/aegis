import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminAuthController } from '../../src/auth/admin-auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
const mockPlatformAdminLoginResponse = {
  accessToken: 'admin-access-token',
  refreshToken: 'admin-refresh-token',
  expiresIn: 900,
  user: {
    id: 'admin-uuid',
    email: 'admin@aegis.ai',
    name: 'Platform Admin',
    role: 'platform_admin' as const,
    tenantId: undefined,
  },
};

const mockTenantAdminLoginResponse = {
  accessToken: 'tenant-access-token',
  refreshToken: 'tenant-refresh-token',
  expiresIn: 900,
  user: {
    id: 'tenant-admin-uuid',
    email: 'tenant-admin@company.com',
    name: 'Tenant Admin',
    role: 'tenant_admin' as const,
    tenantId: 'tenant-uuid',
  },
};

const mockTenantMemberLoginResponse = {
  accessToken: 'member-access-token',
  refreshToken: 'member-refresh-token',
  expiresIn: 900,
  user: {
    id: 'member-uuid',
    email: 'member@company.com',
    name: 'Tenant Member',
    role: 'tenant_member' as const,
    tenantId: 'tenant-uuid',
  },
};

const mockMfaRequiredResponse = {
  mfaRequired: true,
  email: 'admin@aegis.ai',
  message:
    'MFA verification required. Submit your TOTP code to complete authentication.',
};

const mockPlatformAdminMfaResponse = {
  accessToken: 'mfa-access-token',
  refreshToken: 'mfa-refresh-token',
  expiresIn: 900,
  user: {
    id: 'admin-uuid',
    email: 'admin@aegis.ai',
    name: 'Platform Admin',
    role: 'platform_admin' as const,
    mfaEnabled: true,
  },
};

const mockNonAdminMfaResponse = {
  accessToken: 'mfa-access-token',
  refreshToken: 'mfa-refresh-token',
  expiresIn: 900,
  user: {
    id: 'tenant-admin-uuid',
    email: 'tenant-admin@company.com',
    name: 'Tenant Admin',
    role: 'tenant_admin' as const,
    mfaEnabled: true,
  },
};

// ---------------------------------------------------------------------------
// Test Suite: AdminAuthController
// ---------------------------------------------------------------------------
describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let authService: {
    login: jest.Mock;
    verifyMfa: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      verifyMfa: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      // Override the JwtAuthGuard to always pass for controller unit tests
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
  });

  // =========================================================================
  // POST /api/admin/auth/login
  // =========================================================================
  describe('POST /admin/auth/login', () => {
    it('should return login response with tokens and user for platform_admin', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockPlatformAdminLoginResponse);

      // Act
      const result = await controller.adminLogin({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      // Assert
      expect(result).toEqual(mockPlatformAdminLoginResponse);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });
    });

    it('should return MFA required response without role check', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockMfaRequiredResponse);

      // Act
      const result = await controller.adminLogin({
        email: 'admin@aegis.ai',
        password: 'ValidPass123!@',
      });

      // Assert - MFA required passes through (role check at MFA verify stage)
      expect(result).toEqual(mockMfaRequiredResponse);
      expect(result.mfaRequired).toBe(true);
    });

    it('should throw ForbiddenException for tenant_admin role', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockTenantAdminLoginResponse);

      // Act & Assert
      await expect(
        controller.adminLogin({
          email: 'tenant-admin@company.com',
          password: 'ValidPass123!@',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.adminLogin({
          email: 'tenant-admin@company.com',
          password: 'ValidPass123!@',
        }),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should throw ForbiddenException for tenant_member role', async () => {
      // Arrange
      authService.login.mockResolvedValue(mockTenantMemberLoginResponse);

      // Act & Assert
      await expect(
        controller.adminLogin({
          email: 'member@company.com',
          password: 'ValidPass123!@',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.adminLogin({
          email: 'member@company.com',
          password: 'ValidPass123!@',
        }),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should propagate UnauthorizedException from service', async () => {
      // Arrange
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      // Act & Assert
      await expect(
        controller.adminLogin({
          email: 'bad@test.com',
          password: 'WrongPass123!@',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // POST /api/admin/auth/mfa/verify
  // =========================================================================
  describe('POST /admin/auth/mfa/verify', () => {
    it('should return tokens and user for platform_admin after MFA verify', async () => {
      // Arrange
      authService.verifyMfa.mockResolvedValue(mockPlatformAdminMfaResponse);

      // Act
      const result = await controller.adminVerifyMfa({
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });

      // Assert
      expect(result).toEqual(mockPlatformAdminMfaResponse);
      expect(result.user.role).toBe('platform_admin');
      expect(result.user.mfaEnabled).toBe(true);
      expect(authService.verifyMfa).toHaveBeenCalledWith({
        email: 'admin@aegis.ai',
        totpCode: '123456',
      });
    });

    it('should throw ForbiddenException for non-platform_admin after MFA verify', async () => {
      // Arrange
      authService.verifyMfa.mockResolvedValue(mockNonAdminMfaResponse);

      // Act & Assert
      await expect(
        controller.adminVerifyMfa({
          email: 'tenant-admin@company.com',
          totpCode: '123456',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.adminVerifyMfa({
          email: 'tenant-admin@company.com',
          totpCode: '123456',
        }),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should propagate UnauthorizedException from service for invalid MFA code', async () => {
      // Arrange
      authService.verifyMfa.mockRejectedValue(
        new UnauthorizedException('Invalid MFA code'),
      );

      // Act & Assert
      await expect(
        controller.adminVerifyMfa({
          email: 'admin@aegis.ai',
          totpCode: '000000',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // HTTP Status Code Configuration
  // =========================================================================
  describe('HTTP Status Code Configuration', () => {
    it('should configure 200 OK for POST /admin/auth/login', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AdminAuthController.prototype.adminLogin,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for POST /admin/auth/mfa/verify', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AdminAuthController.prototype.adminVerifyMfa,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  // =========================================================================
  // Guard Configuration Verification
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should NOT have JwtAuthGuard on POST /admin/auth/login (public endpoint)', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        AdminAuthController.prototype.adminLogin,
      );
      // Login is a public endpoint - should have no guards
      expect(guards).toBeUndefined();
    });

    it('should NOT have JwtAuthGuard on POST /admin/auth/mfa/verify (public endpoint)', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        AdminAuthController.prototype.adminVerifyMfa,
      );
      // MFA verify is a public endpoint - should have no guards
      expect(guards).toBeUndefined();
    });
  });
});
