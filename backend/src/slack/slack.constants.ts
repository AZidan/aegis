/**
 * Slack Integration Constants
 *
 * OAuth scopes, config keys, and shared constants for the Slack module.
 */

/**
 * Bot token scopes requested during Slack OAuth installation.
 * These define what the Aegis Slack App can do in a workspace.
 */
export const SLACK_BOT_SCOPES = [
  'chat:write',
  'channels:history',
  'groups:history',
  'im:history',
  'channels:read',
  'users:read',
  'commands',
  'app_mentions:read',
] as const;

/**
 * Environment variable keys for Slack configuration.
 */
export const SLACK_CONFIG_KEYS = {
  CLIENT_ID: 'slack.clientId',
  CLIENT_SECRET: 'slack.clientSecret',
  SIGNING_SECRET: 'slack.signingSecret',
  APP_TOKEN: 'slack.appToken',
  REDIRECT_URI: 'slack.redirectUri',
} as const;

/**
 * Slack API error codes that indicate a revoked or invalid token.
 */
export const SLACK_TOKEN_REVOKED_ERRORS = [
  'token_revoked',
  'invalid_auth',
  'account_inactive',
  'not_authed',
] as const;

/**
 * Slack API error code for rate limiting.
 */
export const SLACK_RATE_LIMITED_ERROR = 'ratelimited';

/**
 * Aegis slash command name.
 */
export const AEGIS_SLASH_COMMAND = '/aegis';
