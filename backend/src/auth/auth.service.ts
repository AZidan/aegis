import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/refresh-token.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  // ==========================================================================
  // POST /api/auth/login - Email + Password Login
  // Contract: Returns { accessToken, refreshToken, expiresIn, user }
  // ==========================================================================
  async login(dto: LoginDto) {
    const { email, password } = dto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        tenantId: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    });

    if (!user || !user.password) {
      this.auditService.logAction({
        actorType: 'system',
        actorId: 'auth-service',
        actorName: 'Authentication Service',
        action: 'user_login_failed',
        targetType: 'user',
        targetId: email,
        details: { reason: 'user_not_found' },
        severity: 'warning',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.auditService.logAction({
        actorType: 'system',
        actorId: 'auth-service',
        actorName: 'Authentication Service',
        action: 'user_login_failed',
        targetType: 'user',
        targetId: email,
        details: { reason: 'invalid_credentials' },
        severity: 'warning',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // If MFA is enabled, require MFA verification before issuing tokens
    // Contract: MFA is required for platform_admin
    if (user.mfaEnabled) {
      return {
        mfaRequired: true,
        email: user.email,
        message:
          'MFA verification required. Submit your TOTP code to complete authentication.',
      };
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token in DB
    await this.storeRefreshToken(tokens.refreshToken, user.id);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: user.id,
      actorName: user.email,
      action: 'user_login',
      targetType: 'user',
      targetId: user.id,
      details: { method: 'email_password', mfaRequired: false },
      severity: 'info',
      tenantId: user.tenantId || null,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId || undefined,
      },
    };
  }

  // ==========================================================================
  // POST /api/auth/login/oauth - OAuth Login
  // Contract: Same response format as email/password login
  // ==========================================================================
  async oauthLogin(dto: OAuthLoginDto) {
    const { provider, code, redirectUri } = dto;

    let oauthProfile: { email: string; name: string; oauthId: string };

    try {
      if (provider === 'google') {
        oauthProfile = await this.verifyGoogleOAuth(code, redirectUri);
      } else if (provider === 'github') {
        oauthProfile = await this.verifyGithubOAuth(code, redirectUri);
      } else {
        throw new BadRequestException(
          'Invalid OAuth code or provider mismatch',
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`OAuth verification failed for ${provider}`, error);
      throw new BadRequestException('Invalid OAuth code or provider mismatch');
    }

    // Find or create user
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: oauthProfile.email },
          { oauthProvider: provider, oauthId: oauthProfile.oauthId },
        ],
      },
    });

    if (!user) {
      throw new BadRequestException(
        'No account found for this email. Please accept a team invitation from your tenant admin first.',
      );
    }

    if (!user.tenantId) {
      throw new BadRequestException(
        'Your account is not assigned to any tenant. Please contact your tenant admin for an invitation.',
      );
    }

    if (!user.oauthProvider) {
      // Link OAuth to existing user
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          oauthProvider: provider,
          oauthId: oauthProfile.oauthId,
        },
      });
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token
    await this.storeRefreshToken(tokens.refreshToken, user.id);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId || undefined,
      },
    };
  }

  // ==========================================================================
  // POST /api/auth/refresh - Refresh Access Token
  // Contract: Returns { accessToken, expiresIn } only
  // ==========================================================================
  async refreshToken(dto: RefreshTokenDto) {
    const { refreshToken } = dto;

    // Verify refresh token exists in DB and is not expired/revoked
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (new Date() > storedToken.expiresAt) {
      // Clean up expired token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = storedToken.user;

    // Generate new access token only (contract specifies only accessToken + expiresIn)
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || undefined,
      permissions: this.getPermissionsForRole(user.role),
    };

    const accessToken = this.jwtService.sign(payload as unknown as Record<string, unknown>);

    return {
      accessToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  // ==========================================================================
  // POST /api/auth/logout - Logout (Invalidate Refresh Token)
  // Contract: Returns 204 No Content
  // ==========================================================================
  async logout(dto: LogoutDto) {
    const { refreshToken } = dto;

    // Revoke the refresh token
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
    }

    // No error even if token not found - idempotent operation
  }

  // ==========================================================================
  // POST /api/auth/mfa/verify - MFA Verification
  // Contract: Takes { email, totpCode }, returns tokens + user
  // ==========================================================================
  async verifyMfa(dto: MfaVerifyDto) {
    const { email, totpCode } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        tenantId: true,
        mfaEnabled: true,
        mfaSecret: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Verify TOTP code
    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1, // Allow 1 window tolerance (30 seconds before/after)
    });

    if (!isValid) {
      this.auditService.logAction({
        actorType: 'system',
        actorId: 'auth-service',
        actorName: 'Authentication Service',
        action: 'mfa_verification_failed',
        targetType: 'user',
        targetId: email,
        details: { reason: 'invalid_totp_code' },
        severity: 'warning',
      });
      throw new UnauthorizedException('Invalid MFA code');
    }

    // MFA verified - generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token
    await this.storeRefreshToken(tokens.refreshToken, user.id);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.auditService.logAction({
      actorType: 'user',
      actorId: user.id,
      actorName: user.email,
      action: 'mfa_verification_success',
      targetType: 'user',
      targetId: user.id,
      details: { method: 'totp' },
      severity: 'info',
      tenantId: user.tenantId || null,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: true,
      },
    };
  }

  // ==========================================================================
  // GET /api/auth/me - Get Current User
  // Contract: Returns user profile with permissions array
  // ==========================================================================
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId || undefined,
      permissions: this.getPermissionsForRole(user.role),
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ==========================================================================
  // Helper: Generate Access + Refresh Tokens
  // ==========================================================================
  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    tenantId?: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || undefined,
      permissions: this.getPermissionsForRole(user.role),
    };

    const accessToken = this.jwtService.sign(payload as unknown as Record<string, unknown>);

    // Refresh token uses a different secret and longer expiry
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: uuidv4() } as unknown as Record<string, unknown>,
      {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      },
    );

    return { accessToken, refreshToken };
  }

  // ==========================================================================
  // Helper: Store Refresh Token in DB
  // ==========================================================================
  private async storeRefreshToken(token: string, userId: string) {
    // Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  // ==========================================================================
  // Helper: Role-based Permissions
  // ==========================================================================
  private getPermissionsForRole(role: string): string[] {
    switch (role) {
      case 'platform_admin':
        return [
          'admin:dashboard:read',
          'admin:tenants:read',
          'admin:tenants:write',
          'admin:tenants:delete',
          'admin:skills:read',
          'admin:skills:review',
          'admin:alerts:read',
        ];
      case 'tenant_admin':
        return [
          'dashboard:read',
          'agents:read',
          'agents:write',
          'agents:delete',
          'skills:read',
          'skills:install',
          'team:read',
          'team:write',
          'team:invite',
          'audit:read',
          'settings:read',
          'settings:write',
          'api-keys:read',
          'api-keys:write',
        ];
      case 'tenant_member':
        return [
          'dashboard:read',
          'agents:read',
          'skills:read',
          'team:read',
          'audit:read',
          'settings:read',
        ];
      default:
        return [];
    }
  }

  // ==========================================================================
  // Helper: Verify Google OAuth Code
  // ==========================================================================
  private async verifyGoogleOAuth(
    code: string,
    redirectUri: string,
  ): Promise<{ email: string; name: string; oauthId: string }> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange Google OAuth code');
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };

      // Fetch user profile
      const profileResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch Google user profile');
      }

      const profile = (await profileResponse.json()) as {
        id: string;
        email: string;
        name: string;
      };

      return {
        email: profile.email,
        name: profile.name,
        oauthId: profile.id,
      };
    } catch (error) {
      this.logger.error('Google OAuth verification failed', error);
      throw new BadRequestException('Invalid OAuth code or provider mismatch');
    }
  }

  // ==========================================================================
  // Helper: Verify GitHub OAuth Code
  // ==========================================================================
  private async verifyGithubOAuth(
    code: string,
    redirectUri: string,
  ): Promise<{ email: string; name: string; oauthId: string }> {
    const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth is not configured');
    }

    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange GitHub OAuth code');
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };

      if (!tokenData.access_token) {
        throw new Error('No access token received from GitHub');
      }

      // Fetch user profile
      const profileResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
        },
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch GitHub user profile');
      }

      const profile = (await profileResponse.json()) as {
        id: number;
        email: string | null;
        name: string | null;
        login: string;
      };

      // GitHub may not return email - fetch from emails endpoint
      let email = profile.email;
      if (!email) {
        const emailsResponse = await fetch(
          'https://api.github.com/user/emails',
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Accept: 'application/json',
            },
          },
        );
        if (emailsResponse.ok) {
          const emails = (await emailsResponse.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          const primaryEmail = emails.find((e) => e.primary && e.verified);
          email = primaryEmail?.email || emails[0]?.email || null;
        }
      }

      if (!email) {
        throw new BadRequestException(
          'Could not retrieve email from GitHub. Please ensure your email is public or verified.',
        );
      }

      return {
        email,
        name: profile.name || profile.login,
        oauthId: String(profile.id),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('GitHub OAuth verification failed', error);
      throw new BadRequestException('Invalid OAuth code or provider mismatch');
    }
  }
}
