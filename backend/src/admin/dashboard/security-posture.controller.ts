import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SecurityPostureService } from './security-posture.service';

@Controller('admin/dashboard/security-posture')
@UseGuards(JwtAuthGuard)
export class SecurityPostureController {
  constructor(
    private readonly securityPostureService: SecurityPostureService,
  ) {}

  // GET /api/admin/dashboard/security-posture
  @Get()
  @HttpCode(HttpStatus.OK)
  async getSecurityPosture(@CurrentUser() user: { role: string }) {
    if (user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }
    return this.securityPostureService.getSecurityPosture();
  }
}
