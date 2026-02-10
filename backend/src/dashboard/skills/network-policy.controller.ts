import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/validation.pipe';
import { NetworkPolicyService } from './network-policy.service';
import {
  validateDomainSchema,
  ValidateDomainDto,
} from './dto/network-policy.dto';

@Controller('dashboard/skills')
@UseGuards(JwtAuthGuard, TenantGuard)
export class NetworkPolicyController {
  constructor(private readonly networkPolicyService: NetworkPolicyService) {}

  private getTenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId;
  }

  // GET /api/dashboard/skills/network-policy
  @Get('network-policy')
  @HttpCode(HttpStatus.OK)
  async getNetworkPolicy(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.networkPolicyService.generatePolicy(tenantId);
  }

  // POST /api/dashboard/skills/network-policy/validate
  @Post('network-policy/validate')
  @HttpCode(HttpStatus.OK)
  async validateDomain(
    @Req() req: Request,
    @Body(new ZodValidationPipe(validateDomainSchema)) dto: ValidateDomainDto,
  ) {
    const tenantId = this.getTenantId(req);
    return this.networkPolicyService.validateDomain(
      tenantId,
      dto.domain,
      dto.agentId,
    );
  }
}
