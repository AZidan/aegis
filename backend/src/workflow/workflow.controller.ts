import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { WorkflowService } from './workflow.service';
import {
  triggerWorkflowSchema,
  TriggerWorkflowDto,
} from './dto/trigger-workflow.dto';
import {
  queryInstancesSchema,
  QueryInstancesDto,
} from './dto/query-instances.dto';

/**
 * WorkflowController
 *
 * Tenant-scoped coordination workflow endpoints.
 * Sprint 7 -- S7-01
 *
 * Endpoints:
 * 1. GET  /api/dashboard/workflows/templates            - List templates
 * 2. POST /api/dashboard/workflows/templates/:id/trigger - Trigger a workflow
 * 3. GET  /api/dashboard/workflows/instances             - List instances
 * 4. GET  /api/dashboard/workflows/instances/:id         - Get instance detail
 */
@Controller('dashboard/workflows')
@UseGuards(JwtAuthGuard, TenantGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /** GET /api/dashboard/workflows/templates */
  @Get('templates')
  async getTemplates(@Req() req: Request) {
    const tenantId = (req as any).tenantId;
    return this.workflowService.getTemplates(tenantId);
  }

  /** POST /api/dashboard/workflows/templates/:id/trigger */
  @Post('templates/:id/trigger')
  @HttpCode(HttpStatus.CREATED)
  async triggerWorkflow(
    @Param('id') templateId: string,
    @Body(new ZodValidationPipe(triggerWorkflowSchema))
    dto: TriggerWorkflowDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).user?.id;
    return this.workflowService.triggerWorkflow(
      templateId,
      dto,
      tenantId,
      userId,
    );
  }

  /** GET /api/dashboard/workflows/instances */
  @Get('instances')
  async getInstances(
    @Query(new ZodValidationPipe(queryInstancesSchema))
    query: QueryInstancesDto,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId;
    return this.workflowService.getInstances(tenantId, query);
  }

  /** GET /api/dashboard/workflows/instances/:id */
  @Get('instances/:id')
  async getInstanceById(
    @Param('id') instanceId: string,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId;
    return this.workflowService.getInstanceById(instanceId, tenantId);
  }
}
