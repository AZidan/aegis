import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlatformDispatcherService } from './platform-dispatcher.service';
import {
  ForwardToContainerJob,
  DispatchToPlatformJob,
} from './interfaces/channel-proxy.interface';
import { CHANNEL_PROXY_QUEUE_NAME } from './channel-proxy.constants';

@Processor(CHANNEL_PROXY_QUEUE_NAME)
export class ChannelProxyProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelProxyProcessor.name);

  constructor(private readonly platformDispatcher: PlatformDispatcherService) {
    super();
  }

  async process(
    job: Job<ForwardToContainerJob | DispatchToPlatformJob>,
  ): Promise<void> {
    try {
      if (job.name === 'forward-to-container') {
        await this.handleForwardToContainer(
          job as Job<ForwardToContainerJob>,
        );
      } else if (job.name === 'dispatch-to-platform') {
        await this.handleDispatchToPlatform(
          job as Job<DispatchToPlatformJob>,
        );
      }
    } catch (error) {
      this.logger.error(
        `Channel proxy processor error (${job.name}): ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  private async handleForwardToContainer(
    job: Job<ForwardToContainerJob>,
  ): Promise<void> {
    const { sessionContext, event, containerUrl } = job.data;

    const url = `${containerUrl}/hooks/aegis`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionContext.sessionId,
        agentId: sessionContext.agentId,
        tenantId: sessionContext.tenantId,
        platform: sessionContext.platform,
        event,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Container forward failed: ${response.status} ${response.statusText}`,
      );
    }

    this.logger.log(
      `Forwarded to container: session ${sessionContext.sessionId} -> ${url}`,
    );
  }

  private async handleDispatchToPlatform(
    job: Job<DispatchToPlatformJob>,
  ): Promise<void> {
    const { message, credentials } = job.data;

    const result = await this.platformDispatcher.dispatch(message, credentials);

    if (!result.success) {
      throw new Error(`Platform dispatch failed for ${message.platform}`);
    }

    this.logger.log(
      `Dispatched to ${message.platform}: messageId=${result.messageId}`,
    );
  }
}
