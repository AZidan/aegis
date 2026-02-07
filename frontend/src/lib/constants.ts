/**
 * Application-wide constants
 */

// Application metadata
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Aegis Platform';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
export const APP_ENV = process.env.NEXT_PUBLIC_ENV || 'development';

// API configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

// OAuth configuration
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
export const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '';
export const OAUTH_REDIRECT_URI = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || 'http://localhost:3001/auth/callback';

// Feature flags
export const ENABLE_DARK_MODE = process.env.NEXT_PUBLIC_ENABLE_DARK_MODE === 'true';
export const ENABLE_ANALYTICS = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';
export const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG === 'true';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Session configuration
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
export const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// UI configuration
export const SIDEBAR_WIDTH_EXPANDED = 256; // 256px
export const SIDEBAR_WIDTH_COLLAPSED = 64; // 64px

// Agent status types
export const AGENT_STATUS = {
  ACTIVE: 'active',
  IDLE: 'idle',
  ERROR: 'error',
  PROVISIONING: 'provisioning',
  SUSPENDED: 'suspended',
} as const;

export type AgentStatus = typeof AGENT_STATUS[keyof typeof AGENT_STATUS];

// Container health types
export const CONTAINER_HEALTH = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  DOWN: 'down',
  UNKNOWN: 'unknown',
} as const;

export type ContainerHealth = typeof CONTAINER_HEALTH[keyof typeof CONTAINER_HEALTH];

// User roles
export const USER_ROLES = {
  PLATFORM_ADMIN: 'platform_admin',
  TENANT_ADMIN: 'tenant_admin',
  TENANT_MEMBER: 'tenant_member',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Plan tiers
export const PLAN_TIERS = {
  FREE: 'free',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type PlanTier = typeof PLAN_TIERS[keyof typeof PLAN_TIERS];

// Skill categories
export const SKILL_CATEGORIES = [
  'data-analysis',
  'automation',
  'communication',
  'integration',
  'productivity',
  'security',
  'monitoring',
  'custom',
] as const;

export type SkillCategory = typeof SKILL_CATEGORIES[number];

// Skill status
export const SKILL_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
} as const;

export type SkillStatus = typeof SKILL_STATUS[keyof typeof SKILL_STATUS];

// Action types for audit logs
export const AUDIT_ACTIONS = {
  // Tenant actions
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_DELETED: 'tenant.deleted',
  TENANT_SUSPENDED: 'tenant.suspended',
  TENANT_ACTIVATED: 'tenant.activated',

  // Agent actions
  AGENT_CREATED: 'agent.created',
  AGENT_UPDATED: 'agent.updated',
  AGENT_DELETED: 'agent.deleted',
  AGENT_STARTED: 'agent.started',
  AGENT_STOPPED: 'agent.stopped',
  AGENT_RESTARTED: 'agent.restarted',

  // Skill actions
  SKILL_INSTALLED: 'skill.installed',
  SKILL_UNINSTALLED: 'skill.uninstalled',
  SKILL_APPROVED: 'skill.approved',
  SKILL_REJECTED: 'skill.rejected',

  // Team actions
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ROLE_CHANGED: 'member.role_changed',

  // Auth actions
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  PASSWORD_CHANGED: 'password.changed',
  MFA_ENABLED: 'mfa.enabled',
  MFA_DISABLED: 'mfa.disabled',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

// Date format strings
export const DATE_FORMATS = {
  SHORT: 'MMM d, yyyy', // Jan 1, 2024
  LONG: 'MMMM d, yyyy', // January 1, 2024
  WITH_TIME: 'MMM d, yyyy h:mm a', // Jan 1, 2024 12:00 PM
  TIME_ONLY: 'h:mm a', // 12:00 PM
  ISO: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", // 2024-01-01T12:00:00.000Z
} as const;

// Routes
export const ROUTES = {
  // Public routes
  HOME: '/',

  // Auth routes
  LOGIN: '/login',
  REGISTER: '/register',
  MFA_SETUP: '/mfa-setup',
  MFA_VERIFY: '/mfa-verify',
  FORGOT_PASSWORD: '/forgot-password',
  ADMIN_LOGIN: '/admin/login',
  ADMIN_HOME: '/admin',

  // Platform admin routes
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_TENANTS: '/admin/tenants',
  ADMIN_TENANT_NEW: '/admin/tenants/new',
  ADMIN_TENANT_DETAIL: (id: string) => `/admin/tenants/${id}`,
  ADMIN_SKILLS_REVIEW: '/admin/skills',
  ADMIN_SKILL_REVIEW_DETAIL: (id: string) => `/admin/skills/${id}`,

  // Tenant routes
  DASHBOARD: '/dashboard',
  AGENTS: '/dashboard/agents',
  AGENT_DETAIL: (id: string) => `/dashboard/agents/${id}`,
  AGENT_CREATE: '/dashboard/agents/create',
  SKILLS: '/dashboard/skills',
  SKILL_DETAIL: (id: string) => `/dashboard/skills/${id}`,
  TEAM: '/dashboard/team',
  AUDIT: '/dashboard/audit',
  SETTINGS: '/dashboard/settings',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// API error codes (from backend contract)
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// WebSocket event types
export const WS_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Agent events
  AGENT_STATUS_CHANGED: 'agent.status.changed',
  AGENT_ACTIVITY: 'agent.activity',

  // Container events
  CONTAINER_HEALTH_CHANGED: 'container.health.changed',
  PROVISIONING_PROGRESS: 'provisioning.progress',

  // System events
  SYSTEM_ALERT: 'system.alert',
} as const;

export type WebSocketEvent = typeof WS_EVENTS[keyof typeof WS_EVENTS];
