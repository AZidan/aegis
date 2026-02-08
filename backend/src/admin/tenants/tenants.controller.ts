import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/validation.pipe';
import { TenantsService } from './tenants.service';
import { createTenantSchema, CreateTenantDto } from './dto/create-tenant.dto';
import { updateTenantSchema, UpdateTenantDto } from './dto/update-tenant.dto';
import {
  listTenantsQuerySchema,
  ListTenantsQueryDto,
} from './dto/list-tenants-query.dto';

/**
 * Tenants Controller - Platform Admin: Tenants
 * Implements all 8 endpoints from API Contract v1.1.0 Section 3,
 * plus config history and rollback endpoints.
 *
 * All endpoints require JWT authentication and platform_admin role.
 *
 * Endpoints:
 * 1. GET    /api/admin/tenants              - List Tenants (paginated)
 * 2. POST   /api/admin/tenants              - Create Tenant
 * 3. GET    /api/admin/tenants/:id          - Get Tenant Detail
 * 4. PATCH  /api/admin/tenants/:id          - Update Tenant Config
 * 5. DELETE /api/admin/tenants/:id          - Delete Tenant (soft)
 * 6. POST   /api/admin/tenants/:id/actions/restart - Restart Container
 * 7. GET    /api/admin/tenants/:id/health   - Get Container Health
 * 8. GET    /api/admin/tenants/:id/agents   - Get Tenant Agents
 * 9. GET    /api/admin/tenants/:id/config/history  - Get Config History
 * 10. POST  /api/admin/tenants/:id/config/rollback - Rollback Config
 */
@Controller('admin/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Verify the authenticated user has the platform_admin role.
   * Throws ForbiddenException if not.
   */
  private assertPlatformAdmin(user: { role: string }): void {
    if (user.role !== 'platform_admin') {
      throw new ForbiddenException('Requires platform_admin role');
    }
  }

  // ==========================================================================
  // GET /api/admin/tenants - List Tenants
  // Contract: 200 OK, paginated response
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listTenants(
    @CurrentUser() user: { role: string },
    @Query(new ZodValidationPipe(listTenantsQuerySchema))
    query: ListTenantsQueryDto,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.listTenants(query);
  }

  // ==========================================================================
  // POST /api/admin/tenants - Create Tenant
  // Contract: 201 Created
  // ==========================================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTenant(
    @CurrentUser() user: { role: string },
    @Body(new ZodValidationPipe(createTenantSchema)) dto: CreateTenantDto,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.createTenant(dto);
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id - Get Tenant Detail
  // Contract: 200 OK
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getTenantDetail(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.getTenantDetail(id);
  }

  // ==========================================================================
  // PATCH /api/admin/tenants/:id - Update Tenant Config
  // Contract: 200 OK
  // ==========================================================================
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateTenantConfig(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) dto: UpdateTenantDto,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.updateTenantConfig(id, dto, user.id);
  }

  // ==========================================================================
  // DELETE /api/admin/tenants/:id - Delete Tenant (Soft Delete)
  // Contract: 200 OK (NOT 204 - returns response body with grace period info)
  // ==========================================================================
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteTenant(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.deleteTenant(id);
  }

  // ==========================================================================
  // POST /api/admin/tenants/:id/actions/restart - Restart Container
  // Contract: 202 Accepted (async operation)
  // ==========================================================================
  @Post(':id/actions/restart')
  @HttpCode(HttpStatus.ACCEPTED)
  async restartContainer(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.restartContainer(id);
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id/health - Get Container Health
  // Contract: 200 OK
  // ==========================================================================
  @Get(':id/health')
  @HttpCode(HttpStatus.OK)
  async getTenantHealth(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.getTenantHealth(id);
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id/agents - Get Tenant Agents
  // Contract: 200 OK
  // ==========================================================================
  @Get(':id/agents')
  @HttpCode(HttpStatus.OK)
  async getTenantAgents(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.getTenantAgents(id);
  }

  // ==========================================================================
  // GET /api/admin/tenants/:id/config/history - Get Config History
  // Contract: 200 OK
  // ==========================================================================
  @Get(':id/config/history')
  @HttpCode(HttpStatus.OK)
  async getConfigHistory(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.getConfigHistory(id, Number(page) || 1, Number(limit) || 20);
  }

  // ==========================================================================
  // POST /api/admin/tenants/:id/config/rollback - Rollback Config
  // Contract: 200 OK
  // ==========================================================================
  @Post(':id/config/rollback')
  @HttpCode(HttpStatus.OK)
  async rollbackConfig(
    @CurrentUser() user: { id: string; role: string },
    @Param('id') id: string,
    @Body() body: { historyId: string },
  ) {
    this.assertPlatformAdmin(user);
    return this.tenantsService.rollbackConfig(id, body.historyId, user.id);
  }
}
