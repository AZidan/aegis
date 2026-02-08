import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/validation.pipe';
import { AgentsService } from './agents.service';
import { createAgentSchema, CreateAgentDto } from './dto/create-agent.dto';
import { updateAgentSchema, UpdateAgentDto } from './dto/update-agent.dto';
import {
  updateToolPolicySchema,
  UpdateToolPolicyDto,
} from './dto/update-tool-policy.dto';
import {
  listAgentsQuerySchema,
  ListAgentsQueryDto,
} from './dto/list-agents-query.dto';

/**
 * Agents Controller - Tenant: Agents
 * Implements all 8 endpoints from API Contract v1.2.0 Section 6.
 *
 * All endpoints require JWT authentication and a valid tenant context.
 * TenantGuard extracts tenantId from JWT and attaches it to the request.
 *
 * Endpoints:
 * 1.  GET    /api/dashboard/agents                       - List Agents
 * 2.  POST   /api/dashboard/agents                       - Create Agent
 * 3.  GET    /api/dashboard/agents/:id                   - Get Agent Detail
 * 4.  PATCH  /api/dashboard/agents/:id                   - Update Agent
 * 5.  DELETE /api/dashboard/agents/:id                   - Delete Agent
 * 6.  GET    /api/dashboard/agents/:id/tool-policy       - Get Agent Tool Policy
 * 7.  PUT    /api/dashboard/agents/:id/tool-policy       - Update Agent Tool Policy
 * 8.  POST   /api/dashboard/agents/:id/actions/restart   - Restart Agent
 * 9.  POST   /api/dashboard/agents/:id/actions/pause     - Pause Agent
 * 10. POST   /api/dashboard/agents/:id/actions/resume    - Resume Agent
 */
@Controller('dashboard/agents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  /**
   * Extract tenantId from request (set by TenantGuard).
   */
  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // ==========================================================================
  // GET /api/dashboard/agents - List Agents
  // Contract: 200 OK, { data: Agent[] }
  // ==========================================================================
  @Get()
  @HttpCode(HttpStatus.OK)
  async listAgents(
    @Req() req: Request,
    @Query(new ZodValidationPipe(listAgentsQuerySchema))
    query: ListAgentsQueryDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.listAgents(tenantId, query);
  }

  // ==========================================================================
  // POST /api/dashboard/agents - Create Agent
  // Contract: 201 Created
  // ==========================================================================
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAgent(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createAgentSchema)) dto: CreateAgentDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.createAgent(tenantId, dto);
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id - Get Agent Detail
  // Contract: 200 OK
  // ==========================================================================
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAgentDetail(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.getAgentDetail(tenantId, id);
  }

  // ==========================================================================
  // PATCH /api/dashboard/agents/:id - Update Agent
  // Contract: 200 OK
  // ==========================================================================
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateAgent(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAgentSchema)) dto: UpdateAgentDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.updateAgent(tenantId, id, dto);
  }

  // ==========================================================================
  // DELETE /api/dashboard/agents/:id - Delete Agent
  // Contract: 204 No Content
  // ==========================================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgent(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    await this.agentsService.deleteAgent(tenantId, id);
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/activity - Agent Activity Log
  // Contract: Section 6 - Agent Activity
  // ==========================================================================
  @Get(':id/activity')
  @HttpCode(HttpStatus.OK)
  async getAgentActivity(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('period') period?: 'today' | 'week' | 'month',
  ) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.getAgentActivity(tenantId, id, period);
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/logs - Agent Logs
  // Contract: Section 6 - Agent Logs
  // ==========================================================================
  @Get(':id/logs')
  @HttpCode(HttpStatus.OK)
  async getAgentLogs(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('level') level?: 'info' | 'warn' | 'error',
  ) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.getAgentLogs(tenantId, id, level);
  }

  // ==========================================================================
  // GET /api/dashboard/agents/:id/tool-policy - Get Agent Tool Policy
  // Response: { agentId, agentName, role, policy, availableCategories }
  // ==========================================================================
  @Get(':id/tool-policy')
  @HttpCode(HttpStatus.OK)
  async getToolPolicy(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.getToolPolicy(tenantId, id);
  }

  // ==========================================================================
  // PUT /api/dashboard/agents/:id/tool-policy - Update Agent Tool Policy
  // Request: { allow: string[], deny?: string[] }
  // Response: { agentId, policy, updatedAt }
  // ==========================================================================
  @Put(':id/tool-policy')
  @HttpCode(HttpStatus.OK)
  async updateToolPolicy(
    @Req() req: Request,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateToolPolicySchema))
    dto: UpdateToolPolicyDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.updateToolPolicy(tenantId, id, dto);
  }

  // ==========================================================================
  // POST /api/dashboard/agents/:id/actions/restart - Restart Agent
  // Contract: 202 Accepted (async operation)
  // ==========================================================================
  @Post(':id/actions/restart')
  @HttpCode(HttpStatus.ACCEPTED)
  async restartAgent(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.restartAgent(tenantId, id);
  }

  // ==========================================================================
  // POST /api/dashboard/agents/:id/actions/pause - Pause Agent
  // Contract: 200 OK
  // ==========================================================================
  @Post(':id/actions/pause')
  @HttpCode(HttpStatus.OK)
  async pauseAgent(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.pauseAgent(tenantId, id);
  }

  // ==========================================================================
  // POST /api/dashboard/agents/:id/actions/resume - Resume Agent
  // Contract: 200 OK
  // ==========================================================================
  @Post(':id/actions/resume')
  @HttpCode(HttpStatus.OK)
  async resumeAgent(@Req() req: Request, @Param('id') id: string) {
    const tenantId = this.getTenantId(req);
    return this.agentsService.resumeAgent(tenantId, id);
  }
}
