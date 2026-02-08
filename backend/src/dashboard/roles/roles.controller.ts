import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesService } from './roles.service';

/**
 * Roles Controller - Agent Role Configuration
 * Implements GET /api/dashboard/roles from API Contract v1.3.0 Section 5.
 *
 * All endpoints require JWT authentication and a valid tenant context.
 */
@Controller('dashboard/roles')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * GET /api/dashboard/roles - List available agent role configurations
   * Contract: 200 OK, { data: AgentRoleConfig[] }
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listRoles() {
    return this.rolesService.listRoles();
  }
}
