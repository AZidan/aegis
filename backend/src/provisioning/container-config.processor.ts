import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ContainerConfigGeneratorService } from './container-config-generator.service';
import { CONTAINER_CONFIG_QUEUE_NAME } from './container-config.constants';

/**
 * Job data shape for container config sync jobs.
 */
interface ConfigSyncJobData {
  agentId: string;
}

/**
 * Container Config Processor
 *
 * BullMQ worker that processes agent container configuration sync jobs.
 * Fetches the agent and its role config from the database, generates
 * the workspace file set, and (in a future iteration) pushes the files
 * to the agent's OpenClaw container.
 *
 * MVP: generates workspace files and logs the result. Actual container
 * push is deferred to a later sprint.
 */
@Processor(CONTAINER_CONFIG_QUEUE_NAME)
export class ContainerConfigProcessor extends WorkerHost {
  private readonly logger = new Logger(ContainerConfigProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ContainerConfigGeneratorService,
  ) {
    super();
  }

  async process(
    job: Job<ConfigSyncJobData>,
  ): Promise<{ success: boolean; agentId: string; files: string[] } | void> {
    switch (job.name) {
      case 'sync-agent-config':
        return this.syncAgentConfig(job.data.agentId);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  /**
   * Generate workspace files for the given agent and log the result.
   * Actual container push is deferred (MVP).
   */
  private async syncAgentConfig(
    agentId: string,
  ): Promise<{ success: boolean; agentId: string; files: string[] }> {
    this.logger.log(`Processing config sync for agent: ${agentId}`);

    // Fetch agent with tenant relation
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { tenant: true },
    });

    if (!agent) {
      this.logger.warn(
        `Agent ${agentId} not found - skipping config sync`,
      );
      return { success: false, agentId, files: [] };
    }

    // Fetch role config for the agent's role
    const roleConfig = await this.prisma.agentRoleConfig.findUnique({
      where: { name: agent.role },
    });

    if (!roleConfig) {
      this.logger.warn(
        `RoleConfig for role "${agent.role}" not found - skipping config sync for agent ${agentId}`,
      );
      return { success: false, agentId, files: [] };
    }

    // Parse customTemplates from agent JSON field
    const customTemplates =
      agent.customTemplates != null &&
      typeof agent.customTemplates === 'object'
        ? (agent.customTemplates as {
            soulTemplate?: string;
            agentsTemplate?: string;
            heartbeatTemplate?: string;
          })
        : undefined;

    // Generate workspace files
    const workspace = this.generator.generateWorkspace({
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        modelTier: agent.modelTier,
        thinkingMode: agent.thinkingMode,
        temperature: agent.temperature,
        personality: agent.personality,
        toolPolicy: agent.toolPolicy,
        customTemplates,
      },
      tenant: {
        id: agent.tenant.id,
        companyName: agent.tenant.companyName,
        plan: agent.tenant.plan,
      },
      roleConfig: {
        name: roleConfig.name,
        label: roleConfig.label,
        defaultToolCategories: roleConfig.defaultToolCategories,
        identityEmoji: roleConfig.identityEmoji,
        soulTemplate: roleConfig.soulTemplate,
        agentsTemplate: roleConfig.agentsTemplate,
        heartbeatTemplate: roleConfig.heartbeatTemplate,
        userTemplate: roleConfig.userTemplate,
        openclawConfigTemplate:
          roleConfig.openclawConfigTemplate as Record<string, unknown> | null,
      },
      customTemplates,
    });

    const fileKeys = Object.keys(workspace);
    this.logger.log(
      `Config sync complete for agent ${agentId}: generated ${fileKeys.length} files [${fileKeys.join(', ')}]`,
    );

    // TODO: Push workspace files to agent's OpenClaw container (deferred)

    return { success: true, agentId, files: fileKeys };
  }
}
