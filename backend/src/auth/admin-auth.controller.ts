import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { loginSchema, LoginDto } from './dto/login.dto';
import { mfaVerifySchema, MfaVerifyDto } from './dto/mfa-verify.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/admin/auth/login
   * Admin-only login - rejects non-platform_admin roles with 403
   * Contract: Section 1 - Platform Admin Authentication
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async adminLogin(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);

    // If MFA is required, pass through (role check happens at MFA verify stage)
    if (result.mfaRequired) {
      return result;
    }

    // For successful login, verify the user is a platform_admin
    if (result.user && result.user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }

    return result;
  }

  /**
   * POST /api/admin/auth/mfa/verify
   * Admin-only MFA verification - rejects non-platform_admin roles with 403
   * Contract: Section 1 - Platform Admin Authentication
   */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(mfaVerifySchema))
  async adminVerifyMfa(@Body() dto: MfaVerifyDto) {
    const result = await this.authService.verifyMfa(dto);

    // Verify the user is a platform_admin
    if (result.user && result.user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }

    return result;
  }
}
