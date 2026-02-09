import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MessageEventPayload } from './interfaces/message-event.interface';
import { MessagingGateway } from './messaging.gateway';
import { MESSAGING_QUEUE_NAME } from './messaging.constants';

/**
 * MessagingProcessor
 *
 * BullMQ worker that processes message delivery jobs from the 'agent-messages' queue.
 * Each job represents a pending agent-to-agent message that needs to be marked as delivered.
 *
 * Processing logic:
 * 1. Receives a MessageEventPayload job
 * 2. Updates the message status to 'delivered' with a deliveredAt timestamp
 * 3. On failure, marks the message as 'failed'
 *
 * Error handling is graceful -- delivery failures are logged but never re-thrown,
 * ensuring they don't crash the application or block the queue.
 */
@Processor(MESSAGING_QUEUE_NAME)
export class MessagingProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagingGateway,
  ) {
    super();
  }

  async process(job: Job<MessageEventPayload>): Promise<void> {
    try {
      const { messageId } = job.data;

      const message = await this.prisma.agentMessage.update({
        where: { id: messageId },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
        },
        include: {
          sender: { select: { id: true, name: true, tenantId: true } },
          recipient: { select: { id: true, name: true } },
        },
      });

      // Emit WebSocket event to tenant room (fire-and-forget)
      const tenantId = (message.sender as any)?.tenantId;
      if (tenantId) {
        this.gateway.emitMessageEvent(tenantId, {
          type: 'message_delivered',
          data: {
            messageId: message.id,
            senderId: message.senderId,
            senderName: (message.sender as any)?.name ?? 'Unknown',
            recipientId: message.recipientId,
            recipientName: (message.recipient as any)?.name ?? 'Unknown',
            type: message.type,
            timestamp: new Date().toISOString(),
            correlationId: message.correlationId,
          },
        });
      }

      this.logger.debug(
        `Message delivered: ${messageId} from ${job.data.senderId} to ${job.data.recipientId}`,
      );
    } catch (error) {
      // On error, mark as failed but never re-throw
      try {
        const failed = await this.prisma.agentMessage.update({
          where: { id: job.data.messageId },
          data: { status: 'failed' },
          include: {
            sender: { select: { id: true, name: true, tenantId: true } },
            recipient: { select: { id: true, name: true } },
          },
        });

        // Emit failure event to tenant room
        const tenantId = (failed.sender as any)?.tenantId;
        if (tenantId) {
          this.gateway.emitMessageEvent(tenantId, {
            type: 'message_failed',
            data: {
              messageId: failed.id,
              senderId: failed.senderId,
              senderName: (failed.sender as any)?.name ?? 'Unknown',
              recipientId: failed.recipientId,
              recipientName: (failed.recipient as any)?.name ?? 'Unknown',
              type: failed.type,
              timestamp: new Date().toISOString(),
              correlationId: failed.correlationId,
            },
          });
        }
      } catch (updateError) {
        // If even the status update fails, just log it
        this.logger.error(
          `Failed to mark message as failed: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
        );
      }

      this.logger.error(
        `Failed to deliver message ${job.data.messageId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
