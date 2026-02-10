import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { SlackOAuthService } from './slack-oauth.service';

/**
 * SlackOAuthController
 *
 * Endpoints for the Slack OAuth installation flow:
 *
 *   GET /api/integrations/slack/install   - Generate OAuth URL (requires auth)
 *   GET /api/integrations/slack/callback  - Handle OAuth callback (no auth)
 */
@Controller('integrations/slack')
export class SlackOAuthController {
  constructor(private readonly oauthService: SlackOAuthService) {}

  /**
   * Generate a Slack OAuth installation URL.
   * Requires JWT authentication with tenant context.
   * Returns the URL that the frontend should redirect the user to.
   */
  @Get('install')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  getInstallUrl(@Req() req: Request): { url: string } {
    const tenantId = (req as Request & { tenantId: string }).tenantId;
    const url = this.oauthService.generateOAuthUrl(tenantId);
    return { url };
  }

  /**
   * Handle Slack OAuth callback.
   * This is called by Slack after the user authorizes the app.
   * No authentication required (redirect from Slack).
   *
   * Query params:
   * - code: Authorization code from Slack
   * - state: The tenantId we passed during install
   * - error: Error code if the user denied access
   */
  @Get('callback')
  @HttpCode(HttpStatus.OK)
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ): Promise<{
    success: boolean;
    workspaceId?: string;
    workspaceName?: string;
    error?: string;
  }> {
    if (error) {
      return { success: false, error: `Slack authorization denied: ${error}` };
    }

    if (!code || !state) {
      throw new BadRequestException(
        'Missing required query parameters: code and state',
      );
    }

    return this.oauthService.handleCallback(code, state);
  }
}
