import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CONTAINER_CONFIG_QUEUE_NAME } from './container-config.constants';

/**
 * Container Config Sync Service
 *
 * Fire-and-forget service that enqueues agent configuration sync jobs
 * to the container-config BullMQ queue. Called after agent CRUD operations
 * to push updated workspace files to the agent's OpenClaw container.
 *
 * Errors are logged but never propagated to the caller, ensuring that
 * config sync failures do not break the primary request flow.
 */
@Injectable()
export class ContainerConfigSyncService {
  private readonly logger = new Logger(ContainerConfigSyncService.name);

  constructor(
    @InjectQueue(CONTAINER_CONFIG_QUEUE_NAME)
    private readonly queue: Queue,
  ) {}

  /**
   * Enqueue a config sync job for the given agent.
   * Fire-and-forget: errors are logged but never thrown.
   *
   * @param agentId - UUID of the agent whose config should be synced
   */
  async syncAgentConfig(agentId: string): Promise<void> {
    try {
      await this.queue.add('sync-agent-config', { agentId }, {
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      });

      this.logger.debug(
        `Config sync job enqueued for agent: ${agentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue config sync for agent ${agentId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Fire-and-forget: never throw
    }
  }
}
