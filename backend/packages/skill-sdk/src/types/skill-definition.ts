/**
 * Core type definitions for Aegis Skill SDK.
 */

import { PermissionManifest } from './permission-manifest';

/** Supported skill categories (mirrors Prisma SkillCategory enum) */
export type SkillCategory =
  | 'productivity'
  | 'communication'
  | 'analytics'
  | 'security'
  | 'integration'
  | 'custom';

/** Context object passed to skill handler at runtime */
export interface SkillContext {
  /** Unique execution ID */
  executionId: string;
  /** Agent ID executing the skill */
  agentId: string;
  /** Tenant ID scope */
  tenantId: string;
  /** Resolved configuration values */
  config: Record<string, unknown>;
  /** Environment variables (only those declared in manifest) */
  env: Record<string, string>;
  /** Logging utility */
  logger: {
    info: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
}

/** Result returned by a skill handler */
export interface SkillResult {
  /** Whether the skill executed successfully */
  success: boolean;
  /** Output data (must be JSON-serializable) */
  data?: unknown;
  /** Human-readable message */
  message?: string;
  /** Error details if success is false */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Configuration option for a skill */
export interface SkillConfigOption {
  /** Config key */
  key: string;
  /** Display label */
  label: string;
  /** Option description */
  description?: string;
  /** Value type */
  type: 'string' | 'number' | 'boolean' | 'select';
  /** Whether this config is required */
  required: boolean;
  /** Default value */
  defaultValue?: string | number | boolean;
  /** Allowed values for 'select' type */
  options?: string[];
}

/** Skill handler function type */
export type SkillHandler = (
  input: Record<string, unknown>,
  context: SkillContext,
) => Promise<SkillResult>;

/** Complete skill definition */
export interface SkillDefinition {
  /** Skill name (kebab-case, e.g. "web-search-pro") */
  name: string;
  /** Semantic version */
  version: string;
  /** Human-readable description */
  description: string;
  /** Skill category */
  category: SkillCategory;
  /** Compatible agent roles */
  compatibleRoles: string[];
  /** Permission manifest */
  permissions: PermissionManifest;
  /** Configuration options */
  config?: SkillConfigOption[];
  /** Skill handler function */
  handler: SkillHandler;
}
