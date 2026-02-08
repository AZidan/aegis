import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { MessagingService } from './messaging.service';
import { AllowlistService } from './allowlist.service';
import { sendMessageSchema, SendMessageDto } from './dto/send-message.dto';
import {
  queryMessagesSchema,
  QueryMessagesDto,
} from './dto/query-messages.dto';
import {
  manageAllowlistSchema,
  ManageAllowlistDto,
} from './dto/manage-allowlist.dto';

/**
 * Messaging Controller - Inter-Agent Communication
 *
 * Handles message sending, retrieval, and allowlist management.
 * All endpoints require JWT authentication and a valid tenant context.
 *
 * Uses @Controller('dashboard') instead of @Controller('dashboard/agents') because
 * it has mixed routes: some under agents/:id/messages and agents/:id/allowlist,
 * and some at messages and communication-graph.
 *
 * Endpoints:
 * 1. POST   /api/dashboard/agents/:id/messages        - Send Message
 * 2. GET    /api/dashboard/agents/:id/messages         - Get Agent Messages
 * 3. GET    /api/dashboard/messages                    - Get Tenant Messages
 * 4. PUT    /api/dashboard/agents/:id/allowlist        - Update Allowlist
 * 5. GET    /api/dashboard/agents/:id/allowlist        - Get Allowlist
 * 6. GET    /api/dashboard/communication-graph         - Communication Graph
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly allowlistService: AllowlistService,
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
  // POST /api/dashboard/agents/:id/messages - Send Message
  // Contract: 201 Created
  // ==========================================================================
  @Post('agents/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Req() req: Request,
    @Param('id') agentId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.messagingService.sendMessage(agentId, dto, tenantId, userId);
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/messages - Get Agent Messages
  // Contract: 200 OK, cursor-based pagination
  // ==========================================================================
  @Get('agents/:id/messages')
  @HttpCode(HttpStatus.OK)
  async getAgentMessages(
    @Req() req: Request,
    @Param('id') agentId: string,
    @Query(new ZodValidationPipe(queryMessagesSchema))
    query: QueryMessagesDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.messagingService.getAgentMessages(agentId, query, tenantId);
  }

  // ==========================================================================
  // GET /api/dashboard/messages - Get Tenant Messages
  // Contract: 200 OK, cursor-based pagination
  // ==========================================================================
  @Get('messages')
  @HttpCode(HttpStatus.OK)
  async getTenantMessages(
    @Req() req: Request,
    @Query(new ZodValidationPipe(queryMessagesSchema))
    query: QueryMessagesDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.messagingService.getTenantMessages(tenantId, query);
  }

  // ==========================================================================
  // PUT /api/dashboard/agents/:id/allowlist - Update Allowlist
  // Contract: 200 OK, full-replace semantics
  // ==========================================================================
  @Put('agents/:id/allowlist')
  @HttpCode(HttpStatus.OK)
  async updateAllowlist(
    @Req() req: Request,
    @Param('id') agentId: string,
    @Body(new ZodValidationPipe(manageAllowlistSchema))
    dto: ManageAllowlistDto,
  ) {
    const tenantId = this.getTenantId(req);
    const userId = this.getUserId(req);
    return this.allowlistService.updateAllowlist(
      agentId,
      dto.entries,
      tenantId,
      userId,
    );
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/allowlist - Get Allowlist
  // Contract: 200 OK
  // ==========================================================================
  @Get('agents/:id/allowlist')
  @HttpCode(HttpStatus.OK)
  async getAgentAllowlist(
    @Req() req: Request,
    @Param('id') agentId: string,
  ) {
    const tenantId = this.getTenantId(req);
    return this.allowlistService.getAgentAllowlist(agentId, tenantId);
  }

  // ==========================================================================
  // GET /api/dashboard/communication-graph - Communication Graph
  // Contract: 200 OK
  // ==========================================================================
  @Get('communication-graph')
  @HttpCode(HttpStatus.OK)
  async getCommunicationGraph(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.allowlistService.getCommunicationGraph(tenantId);
  }
}
