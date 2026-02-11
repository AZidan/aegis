import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).default('3000').transform(Number),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/).default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),

  CONTAINER_RUNTIME: z
    .enum(['mock', 'docker', 'kubernetes'])
    .default('mock'),
  CONTAINER_DOCKER_HOST: z.string().optional(),
  CONTAINER_OPENCLAW_IMAGE: z.string().default('openclaw/openclaw:secrets'),
  CONTAINER_NETWORK_NAME: z.string().default('aegis-tenant-network'),
  CONTAINER_BASE_PORT: z.string().regex(/^\d+$/).default('19000').transform(Number),
  CONTAINER_PORT_RANGE: z.string().regex(/^\d+$/).default('1000').transform(Number),
  CONTAINER_K8S_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),
  CONTAINER_K8S_NAMESPACE: z.string().optional(),
  CONTAINER_K8S_CONTEXT: z.string().optional(),
  CONTAINER_K8S_SERVICE_DOMAIN: z.string().optional(),

  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().optional(),

  AEGIS_SECRETS_MASTER_KEY: z.string().optional(),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  BCRYPT_ROUNDS: z.string().regex(/^\d+$/).default('12').transform(Number),
  MFA_ISSUER: z.string().default('Aegis Platform'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(
      `Environment validation error: ${JSON.stringify(result.error.format(), null, 2)}`,
    );
  }

  return result.data;
}
