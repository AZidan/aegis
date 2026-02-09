import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { ChannelConnectionService } from './channel-connection.service';
import { ChannelRoutingService } from './channel-routing.service';
import {
  createConnectionSchema,
  CreateConnectionDto,
} from './dto/create-connection.dto';
import {
  updateConnectionSchema,
  UpdateConnectionDto,
} from './dto/update-connection.dto';
import {
  createRoutingSchema,
  CreateRoutingDto,
} from './dto/create-routing.dto';
import {
  updateRoutingSchema,
  UpdateRoutingDto,
} from './dto/update-routing.dto';

/**
 * ChannelsController
 *
 * REST endpoints for managing channel platform connections and routing rules.
 * All endpoints are tenant-scoped via TenantGuard and require JWT authentication.
 *
 * Connection endpoints:
 *   GET    /api/dashboard/channels              - List connections
 *   POST   /api/dashboard/channels              - Create connection
 *   GET    /api/dashboard/channels/:id          - Get connection
 *   PATCH  /api/dashboard/channels/:id          - Update connection
 *   DELETE /api/dashboard/channels/:id          - Delete connection
 *
 * Routing endpoints:
 *   GET    /api/dashboard/channels/:id/routing              - List routes
 *   POST   /api/dashboard/channels/:id/routing              - Create route
 *   PATCH  /api/dashboard/channels/:id/routing/:ruleId      - Update route
 *   DELETE /api/dashboard/channels/:id/routing/:ruleId      - Delete route
 */
@Controller('dashboard/channels')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ChannelsController {
  constructor(
    private readonly connectionService: ChannelConnectionService,
    private readonly routingService: ChannelRoutingService,
  ) {}

  /**
   * Extract tenantId from request (set by TenantGuard).
   */
  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  /**
   * Extract userId from JWT payload (set by JwtAuthGuard).
   */
  private getUserId(req: Request): string {
    return (req as Request & { user: { sub: string } }).user.sub;
  }

  // ==========================================================================
  // GET /api/dashboard/channels - List Connections
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listConnections(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.connectionService.listConnections(tenantId);
  }

  // ==========================================================================
  // POST /api/dashboard/channels - Create Connection
  // ==========================================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConnection(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createConnectionSchema)) dto: CreateConnectionDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.connectionService.createConnection(dto, tenantId, userId);
  }

  // ==========================================================================
  // GET /api/dashboard/channels/:id - Get Connection
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getConnection(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.connectionService.getConnection(id, tenantId);
  }

  // ==========================================================================
  // PATCH /api/dashboard/channels/:id - Update Connection
  // ==========================================================================
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateConnection(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConnectionSchema)) dto: UpdateConnectionDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.connectionService.updateConnection(id, dto, tenantId, userId);
  }

  // ==========================================================================
  // DELETE /api/dashboard/channels/:id - Delete Connection
  // ==========================================================================
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteConnection(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.connectionService.deleteConnection(id, tenantId, userId);
  }

  // ==========================================================================
  // GET /api/dashboard/channels/:id/routing - List Routes
  // ==========================================================================
  @Get(':id/routing')
  @HttpCode(HttpStatus.OK)
  async listRoutes(@Req() req: Request, @Param('id') connectionId: string) {
    const tenantId = this.getTenantId(req);
    return this.routingService.listRoutes(connectionId, tenantId);
  }

  // ==========================================================================
  // POST /api/dashboard/channels/:id/routing - Create Route
  // ==========================================================================
  @Post(':id/routing')
  @HttpCode(HttpStatus.CREATED)
  async createRoute(
    @Req() req: Request,
    @Param('id') connectionId: string,
    @Body(new ZodValidationPipe(createRoutingSchema)) dto: CreateRoutingDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.routingService.createRoute(connectionId, dto, tenantId, userId);
  }

  // ==========================================================================
  // PATCH /api/dashboard/channels/:id/routing/:ruleId - Update Route
  // ==========================================================================
  @Patch(':id/routing/:ruleId')
  @HttpCode(HttpStatus.OK)
  async updateRoute(
    @Req() req: Request,
    @Param('id') connectionId: string,
    @Param('ruleId') ruleId: string,
    @Body(new ZodValidationPipe(updateRoutingSchema)) dto: UpdateRoutingDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.routingService.updateRoute(connectionId, ruleId, dto, tenantId, userId);
  }

  // ==========================================================================
  // DELETE /api/dashboard/channels/:id/routing/:ruleId - Delete Route
  // ==========================================================================
  @Delete(':id/routing/:ruleId')
  @HttpCode(HttpStatus.OK)
  async deleteRoute(
    @Req() req: Request,
    @Param('id') connectionId: string,
    @Param('ruleId') ruleId: string,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.routingService.deleteRoute(connectionId, ruleId, tenantId, userId);
  }
}
