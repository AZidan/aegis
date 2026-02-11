import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
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
  @Header('Content-Type', 'text/html')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      res.send(this.buildCallbackHtml('slack-oauth-error', { error: `Slack authorization denied: ${error}` }));
      return;
    }

    if (!code || !state) {
      res.send(this.buildCallbackHtml('slack-oauth-error', { error: 'Missing required query parameters' }));
      return;
    }

    try {
      const result = await this.oauthService.handleCallback(code, state);
      res.send(this.buildCallbackHtml('slack-oauth-success', {
        workspaceName: result.workspaceName,
        workspaceId: result.workspaceId,
      }));
    } catch (err) {
      res.send(this.buildCallbackHtml('slack-oauth-error', {
        error: err instanceof Error ? err.message : 'OAuth callback failed',
      }));
    }
  }

  private buildCallbackHtml(
    type: 'slack-oauth-success' | 'slack-oauth-error',
    data: Record<string, string | undefined>,
  ): string {
    const payload = JSON.stringify({ type, ...data });
    return `<!DOCTYPE html>
<html><head><title>Slack Authorization</title></head>
<body>
<p>${type === 'slack-oauth-success' ? 'Connected! This window will close.' : 'Authorization failed.'}</p>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, '*');
  }
  setTimeout(function() { window.close(); }, 1500);
</script>
</body></html>`;
  }
}
