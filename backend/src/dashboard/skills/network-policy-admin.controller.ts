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
import { NetworkPolicyService } from './network-policy.service';

@Controller('admin/dashboard/network-policies')
@UseGuards(JwtAuthGuard)
export class NetworkPolicyAdminController {
  constructor(private readonly networkPolicyService: NetworkPolicyService) {}

  /**
   * Assert the current user is a platform admin.
   * Throws ForbiddenException if not.
   */
  private assertPlatformAdmin(user: { role: string }): void {
    if (user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }
  }

  // GET /api/admin/dashboard/network-policies
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllPolicies(@CurrentUser() user: { role: string }) {
    this.assertPlatformAdmin(user);
    return this.networkPolicyService.getAllPolicies();
  }
}
