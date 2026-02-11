export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl: process.env.GITHUB_CALLBACK_URL,
    },
  },

  container: {
    runtime: process.env.CONTAINER_RUNTIME || 'mock',
    dockerHost: process.env.CONTAINER_DOCKER_HOST || 'unix:///var/run/docker.sock',
    openclawImage:
      process.env.CONTAINER_OPENCLAW_IMAGE || 'openclaw/openclaw:latest',
    networkName: process.env.CONTAINER_NETWORK_NAME || 'aegis-tenant-network',
    basePort: parseInt(process.env.CONTAINER_BASE_PORT || '19000', 10),
    portRange: parseInt(process.env.CONTAINER_PORT_RANGE || '1000', 10),
    kubernetes: {
      enabled: process.env.CONTAINER_K8S_ENABLED === 'true',
      namespace: process.env.CONTAINER_K8S_NAMESPACE || 'aegis-tenants',
      context: process.env.CONTAINER_K8S_CONTEXT || undefined,
      serviceDomain:
        process.env.CONTAINER_K8S_SERVICE_DOMAIN || 'svc.cluster.local',
    },
  },

  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
    redirectUri:
      process.env.SLACK_REDIRECT_URI ||
      `${process.env.APP_URL || 'http://localhost:3000'}/api/integrations/slack/callback`,
  },

  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    mfaIssuer: process.env.MFA_ISSUER || 'Aegis Platform',
  },
});
