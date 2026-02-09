import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChannelProxyService } from './channel-proxy.service';
import {
  InboundEventSchema,
  InboundEventDto,
} from './dto/inbound-event.dto';
import {
  OutboundMessageSchema,
  OutboundMessageDto,
} from './dto/outbound-message.dto';
import { ZodValidationPipe } from '../common/pipes/validation.pipe';

@Controller('api/v1/channel')
export class ChannelProxyController {
  constructor(private readonly proxyService: ChannelProxyService) {}

  /**
   * POST /api/v1/channel/inbound/:platform
   * Webhook endpoint for platform events (no JWT auth -- verified by platform signature).
   */
  @Post('inbound/:platform')
  @HttpCode(HttpStatus.OK)
  async handleInbound(
    @Param('platform') platform: string,
    @Body(new ZodValidationPipe(InboundEventSchema)) body: InboundEventDto,
  ) {
    return this.proxyService.processInbound(platform.toUpperCase(), {
      platform: platform.toUpperCase(),
      ...body,
    });
  }

  /**
   * POST /api/v1/channel/outbound
   * Outbound message endpoint (requires bearer token auth).
   */
  @Post('outbound')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async handleOutbound(
    @Body(new ZodValidationPipe(OutboundMessageSchema))
    body: OutboundMessageDto,
  ) {
    return this.proxyService.processOutbound(body);
  }
}
