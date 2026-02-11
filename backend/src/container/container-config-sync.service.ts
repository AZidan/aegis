import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContainerConfigGeneratorService } from './container-config-generator.service';
import { CONTAINER_ORCHESTRATOR } from './container.constants';
import { ContainerOrchestrator } from './interfaces/container-orchestrator.interface';

/**
 * Synchronises the OpenClaw configuration inside a running tenant container
 * whenever the tenant's agents, skills, channels, or routing rules change.
 *
 * Call `syncTenantConfig(tenantId)` after any mutation that affects
 * what the container should know about.  The method is fire-and-forget safe
 * (logs errors, never throws).
 */
@Injectable()
export class ContainerConfigSyncService {
  private readonly logger = new Logger(ContainerConfigSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configGenerator: ContainerConfigGeneratorService,
    @Inject(CONTAINER_ORCHESTRATOR)
    private readonly orchestrator: ContainerOrchestrator,
  ) {}

  /**
   * Regenerate the OpenClaw config for the given tenant and push it
   * into the running container.  No-ops gracefully if the tenant has
   * no active container.
   */
  async syncTenantConfig(tenantId: string): Promise<void> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, status: true, containerId: true },
      });

      if (!tenant || tenant.status !== 'active' || !tenant.containerId) {
        this.logger.debug(
          `Skipping config sync for tenant ${tenantId}: not active or no container`,
        );
        return;
      }

      const config = await this.configGenerator.generateForTenant(tenantId);

      await this.orchestrator.updateConfig(tenant.containerId, {
        openclawConfig: config as unknown as Record<string, unknown>,
      });

      this.logger.log(
        `Config synced to container for tenant ${tenantId} (${config.agents.list.length} agents)`,
      );
    } catch (error) {
      // Fire-and-forget: log but don't throw so callers are never blocked.
      this.logger.error(
        `Failed to sync config for tenant ${tenantId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
