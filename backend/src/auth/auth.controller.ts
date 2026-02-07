import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { loginSchema, LoginDto } from './dto/login.dto';
import { oauthLoginSchema, OAuthLoginDto } from './dto/oauth-login.dto';
import {
  refreshTokenSchema,
  RefreshTokenDto,
  logoutSchema,
  LogoutDto,
} from './dto/refresh-token.dto';
import { mfaVerifySchema, MfaVerifyDto } from './dto/mfa-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Authenticate using email and password, returns JWT access and refresh tokens
   * Contract: Section 1 - Login (Email + Password)
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/auth/login/oauth
   * Authenticate using OAuth provider (Google/GitHub)
   * Contract: Section 1 - OAuth Login
   */
  @Post('login/oauth')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(oauthLoginSchema))
  async oauthLogin(@Body() dto: OAuthLoginDto) {
    return this.authService.oauthLogin(dto);
  }

  /**
   * POST /api/auth/refresh
   * Obtain a new access token using refresh token
   * Contract: Section 1 - Refresh Token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(refreshTokenSchema))
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  /**
   * POST /api/auth/logout
   * Invalidate refresh token and revoke access
   * Contract: Section 1 - Logout (returns 204 No Content)
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(logoutSchema))
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto);
  }

  /**
   * POST /api/auth/mfa/verify
   * Verify TOTP MFA code (required for platform admins)
   * Contract: Section 1 - MFA Verification
   */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(mfaVerifySchema))
  async verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfa(dto);
  }

  /**
   * GET /api/auth/me
   * Get authenticated user profile
   * Contract: Section 1 - Get Current User
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser('id') userId: string) {
    return this.authService.getCurrentUser(userId);
  }
}
