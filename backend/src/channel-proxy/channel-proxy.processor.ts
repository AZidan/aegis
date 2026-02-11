import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PlatformDispatcherService } from './platform-dispatcher.service';
import { SecretsManagerService } from '../container/secrets-manager.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForwardToContainerJob,
  DispatchToPlatformJob,
} from './interfaces/channel-proxy.interface';
import { CHANNEL_PROXY_QUEUE_NAME } from './channel-proxy.constants';
import { ChannelPlatform } from '../../prisma/generated/client';

@Processor(CHANNEL_PROXY_QUEUE_NAME)
export class ChannelProxyProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelProxyProcessor.name);

  constructor(
    private readonly platformDispatcher: PlatformDispatcherService,
    private readonly secretsManager: SecretsManagerService,
    private readonly prisma: PrismaService,
    @InjectQueue(CHANNEL_PROXY_QUEUE_NAME) private readonly proxyQueue: Queue,
  ) {
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
    const gatewayToken = this.secretsManager.getGatewayTokenForTenant(
      sessionContext.tenantId,
    );

    // Call OpenClaw Responses API (synchronous request-response)
    const url = `${containerUrl}/v1/responses`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        input: event.text,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Container forward failed: ${response.status} ${response.statusText} ${body}`,
      );
    }

    const data = (await response.json()) as {
      output?: Array<{
        content?: Array<{ type: string; text: string }>;
      }>;
      usage?: { input_tokens: number; output_tokens: number };
    };

    const responseText =
      data.output
        ?.flatMap((msg) => msg.content ?? [])
        ?.filter((c) => c.type === 'output_text')
        ?.map((c) => c.text)
        ?.join('\n') ?? '';

    if (!responseText) {
      this.logger.warn(
        `Empty agent response for session ${sessionContext.sessionId}`,
      );
      return;
    }

    // Find active channel connection to enqueue outbound reply
    const connection = await this.prisma.channelConnection.findFirst({
      where: {
        tenantId: sessionContext.tenantId,
        platform: sessionContext.platform as ChannelPlatform,
        status: 'active',
      },
      select: { id: true, credentials: true },
    });

    if (connection) {
      await this.proxyQueue.add('dispatch-to-platform', {
        message: {
          tenantId: sessionContext.tenantId,
          agentId: sessionContext.agentId,
          platform: sessionContext.platform,
          workspaceId: sessionContext.workspaceId,
          channelId: sessionContext.channelId ?? event.channelId ?? '',
          text: responseText,
          threadId: event.threadId,
        },
        connectionId: connection.id,
        credentials: connection.credentials as Record<string, unknown>,
      });
    }

    this.logger.log(
      `Forwarded to container: session ${sessionContext.sessionId}, response ${responseText.length} chars`,
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
