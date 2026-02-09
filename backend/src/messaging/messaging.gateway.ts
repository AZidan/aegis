import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import {
  WsMessageEvent,
  WsMessageEventData,
} from './interfaces/ws-message-event.interface';

/**
 * MessagingGateway
 *
 * WebSocket gateway for real-time inter-agent message streaming.
 * Transport path: /ws/messages (client connects via `io(host, { path: '/ws/messages' })`)
 *
 * Authentication:
 * - JWT token extracted from handshake auth or query params
 * - Verified using the same secret as REST endpoints
 * - Clients without a valid tenant context are disconnected
 *
 * Room strategy:
 * - Each tenant gets a room: `tenant:{tenantId}:messages`
 * - Events emitted to the room reach all connected clients for that tenant
 * - Tenant isolation: tenant A cannot see tenant B events
 *
 * Events emitted:
 * - message_sent: immediately after a message is created (from MessagingService)
 * - message_delivered: after async processor delivers the message
 * - message_failed: if delivery fails in the processor
 *
 * Reconnection:
 * - Client sends 'catch-up' with { since: ISO timestamp }
 * - Gateway returns missed messages from the last 5 minutes max
 */
@WebSocketGateway({ path: '/ws/messages', cors: true })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Authenticate client on WebSocket handshake.
   * Token can be passed via:
   *   - handshake.auth.token (socket.io recommended)
   *   - handshake.query.token (fallback for clients that can't set auth)
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(
          `Connection rejected: no token provided (${client.id})`,
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);

      if (!payload.tenantId) {
        this.logger.warn(
          `Connection rejected: no tenantId in token (${client.id})`,
        );
        client.disconnect();
        return;
      }

      // Attach user data to socket for downstream use
      client.data.user = payload;
      client.data.tenantId = payload.tenantId;

      // Join tenant-scoped room
      client.join(`tenant:${payload.tenantId}:messages`);

      this.logger.debug(
        `Client connected: ${client.id} (tenant: ${payload.tenantId})`,
      );
    } catch (error) {
      this.logger.warn(
        `Connection rejected: ${error instanceof Error ? error.message : 'Invalid token'} (${client.id})`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Emit a message event to all clients in the tenant room.
   * Called by MessagingService (message_sent) and MessagingProcessor (delivered/failed).
   * Fire-and-forget: if no clients are connected, event is silently dropped.
   */
  emitMessageEvent(tenantId: string, event: WsMessageEvent): void {
    this.server
      .to(`tenant:${tenantId}:messages`)
      .emit(event.type, event.data);
  }

  /**
   * Handle reconnection catch-up request.
   * Client sends { since: ISO timestamp } and receives missed messages.
   * Clamped to max 5 minutes back to prevent excessive data transfer.
   */
  @SubscribeMessage('catch-up')
  async handleCatchUp(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { since: string },
  ): Promise<void> {
    const tenantId = client.data?.tenantId;
    if (!tenantId) return;

    // Clamp to max 5 minutes back
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    let since: Date;
    try {
      since = new Date(data.since);
      if (isNaN(since.getTime())) since = fiveMinAgo;
    } catch {
      since = fiveMinAgo;
    }
    const effectiveSince = since > fiveMinAgo ? since : fiveMinAgo;

    // Get all agents for this tenant
    const tenantAgents = await this.prisma.agent.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const agentIds = tenantAgents.map((a) => a.id);

    if (agentIds.length === 0) return;

    // Fetch missed messages since the effective timestamp
    const messages = await this.prisma.agentMessage.findMany({
      where: {
        createdAt: { gte: effectiveSince },
        OR: [
          { senderId: { in: agentIds } },
          { recipientId: { in: agentIds } },
        ],
      },
      include: {
        sender: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100, // Safety limit
    });

    // Emit each missed message as a WS event to the requesting client only
    for (const msg of messages) {
      const eventType: WsMessageEvent['type'] =
        msg.status === 'failed'
          ? 'message_failed'
          : msg.status === 'delivered'
            ? 'message_delivered'
            : 'message_sent';

      const eventData: WsMessageEventData = {
        messageId: msg.id,
        senderId: msg.senderId,
        senderName: (msg.sender as any)?.name ?? 'Unknown',
        recipientId: msg.recipientId,
        recipientName: (msg.recipient as any)?.name ?? 'Unknown',
        type: msg.type,
        timestamp: msg.createdAt.toISOString(),
        correlationId: msg.correlationId,
      };

      client.emit(eventType, eventData);
    }

    this.logger.debug(
      `Catch-up: sent ${messages.length} messages to ${client.id} (since: ${effectiveSince.toISOString()})`,
    );
  }
}
