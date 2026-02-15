import {
  Controller,
  Get,
  Put,
  Post,
  Query,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';
import { BillingService } from './billing.service';
import { UsageWarningService } from './usage-warning.service';
import {
  billingUsageQuerySchema,
  BillingUsageQueryDto,
} from './dto/billing-usage-query.dto';
import {
  overageToggleSchema,
  OverageToggleDto,
} from './dto/overage-toggle.dto';

/**
 * BillingController
 *
 * Tenant-scoped billing dashboard endpoints.
 * Sprint 5 — E12-06/07/08/09.
 *
 * Endpoints:
 * 1. GET  /api/dashboard/billing/overview   - Billing overview with cost breakdown
 * 2. GET  /api/dashboard/billing/usage      - Usage analytics by period/agent
 * 3. GET  /api/dashboard/billing/overage    - Current overage status
 * 4. PUT  /api/dashboard/billing/overage    - Toggle overage billing
 * 5. POST /api/dashboard/billing/agents/:agentId/acknowledge - Acknowledge quota warning
 */
@Controller('dashboard/billing')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly usageWarningService: UsageWarningService,
  ) {}

  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // ==========================================================================
  // GET /api/dashboard/billing/overview
  // ==========================================================================
  @Get('overview')
  async getOverview(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.billingService.getBillingOverview(tenantId);
  }

  // ==========================================================================
  // GET /api/dashboard/billing/usage
  // ==========================================================================
  @Get('usage')
  async getUsage(
    @Req() req: Request,
    @Query(new ZodValidationPipe(billingUsageQuerySchema))
    query: BillingUsageQueryDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.billingService.getBillingUsage(
      tenantId,
      query.period,
      query.agentId,
    );
  }

  // ==========================================================================
  // GET /api/dashboard/billing/overage
  // ==========================================================================
  @Get('overage')
  async getOverageStatus(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.billingService.getOverageStatus(tenantId);
  }

  // ==========================================================================
  // PUT /api/dashboard/billing/overage
  // ==========================================================================
  @Put('overage')
  async toggleOverage(
    @Req() req: Request,
    @Body(new ZodValidationPipe(overageToggleSchema)) body: OverageToggleDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.billingService.toggleOverage(tenantId, body.enabled);
  }

  // ==========================================================================
  // POST /api/dashboard/billing/agents/:agentId/acknowledge
  // ==========================================================================
  @Post('agents/:agentId/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledgeWarning(
    @Req() req: Request,
    @Param('agentId') agentId: string,
  ) {
    const tenantId = this.getTenantId(req);
    return this.usageWarningService.acknowledgeAndResume(tenantId, agentId);
  }
}
