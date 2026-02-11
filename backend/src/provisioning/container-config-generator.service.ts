import { Injectable, Logger } from '@nestjs/common';

/**
 * Map from Aegis model tier names to Anthropic model identifiers.
 */
const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-5',
  opus: 'claude-opus-4-5',
};

/**
 * Map from Aegis thinking mode names to OpenClaw thinking level values.
 */
const THINKING_MAP: Record<string, string> = {
  fast: 'off',
  standard: 'medium',
  extended: 'high',
};

/**
 * The set of workspace files generated for an agent's container configuration.
 */
export interface WorkspaceFiles {
  soulMd: string;
  agentsMd: string;
  userMd: string;
  heartbeatMd: string;
  identityMd: string;
  openclawJson: Record<string, unknown>;
}

/**
 * Options for generating an agent's workspace file set.
 */
export interface GenerateWorkspaceOptions {
  /** Agent record (from Prisma Agent model) */
  agent: {
    id: string;
    name: string;
    role: string;
    modelTier: string;
    thinkingMode: string;
    temperature: number;
    personality?: string | null;
    toolPolicy?: unknown;
    customTemplates?: {
      soulTemplate?: string;
      agentsTemplate?: string;
      heartbeatTemplate?: string;
    } | null;
  };
  /** Tenant record (from Prisma Tenant model) */
  tenant: {
    id: string;
    companyName: string;
    plan: string;
  };
  /** AgentRoleConfig record for the agent's role */
  roleConfig: {
    name: string;
    label: string;
    defaultToolCategories: string[];
    identityEmoji?: string | null;
    soulTemplate?: string | null;
    agentsTemplate?: string | null;
    heartbeatTemplate?: string | null;
    userTemplate?: string | null;
    openclawConfigTemplate?: Record<string, unknown> | null;
  };
  /** Optional per-agent template overrides (from agent.customTemplates) */
  customTemplates?: {
    soulTemplate?: string;
    agentsTemplate?: string;
    heartbeatTemplate?: string;
  } | null;
}

/** Generic fallback template used when role config has no template defined. */
const GENERIC_TEMPLATE = `# {{agentName}}

Role: {{agentRole}}
Tenant: {{tenantName}}
Model: {{modelName}}
`;

/** Default OpenClaw configuration structure. */
const DEFAULT_OPENCLAW_CONFIG: Record<string, unknown> = {
  model: '{{modelName}}',
  thinking: '{{thinkingLevel}}',
  temperature: '{{temperature}}',
};

/**
 * Container Config Generator Service
 *
 * Generates the set of workspace configuration files (SOUL.md, AGENTS.md,
 * HEARTBEAT.md, USER.md, identity.md, openclaw.json) for an agent's
 * OpenClaw container. Templates are sourced from AgentRoleConfig defaults
 * and optionally overridden by per-agent customTemplates.
 */
@Injectable()
export class ContainerConfigGeneratorService {
  private readonly logger = new Logger(ContainerConfigGeneratorService.name);

  /** Exposed for testing. */
  static readonly MODEL_MAP = MODEL_MAP;
  static readonly THINKING_MAP = THINKING_MAP;

  /**
   * Generate the complete set of workspace files for an agent container.
   *
   * Merge priority: customTemplates (per-agent) > roleConfig defaults > generic fallback.
   */
  generateWorkspace(options: GenerateWorkspaceOptions): WorkspaceFiles {
    const context = this.buildContext(options);

    // Merge templates: per-agent custom overrides take precedence over role defaults
    const soulTemplate =
      options.customTemplates?.soulTemplate ??
      options.roleConfig.soulTemplate ??
      GENERIC_TEMPLATE;

    const agentsTemplate =
      options.customTemplates?.agentsTemplate ??
      options.roleConfig.agentsTemplate ??
      GENERIC_TEMPLATE;

    const heartbeatTemplate =
      options.customTemplates?.heartbeatTemplate ??
      options.roleConfig.heartbeatTemplate ??
      GENERIC_TEMPLATE;

    const userTemplate =
      options.roleConfig.userTemplate ?? GENERIC_TEMPLATE;

    // Hydrate all templates
    const soulMd = this.hydrateTemplate(soulTemplate, context);
    const agentsMd = this.hydrateTemplate(agentsTemplate, context);
    const heartbeatMd = this.hydrateTemplate(heartbeatTemplate, context);
    const userMd = this.hydrateTemplate(userTemplate, context);

    // Identity file
    const emoji = options.roleConfig.identityEmoji ?? 'robot';
    const identityMd = this.hydrateTemplate(
      `# Identity\nEmoji: :{{identityEmoji}}:\nRole: {{agentRole}}\nName: {{agentName}}`,
      { ...context, identityEmoji: emoji },
    );

    // OpenClaw config JSON
    const openclawConfigTemplate =
      options.roleConfig.openclawConfigTemplate ?? DEFAULT_OPENCLAW_CONFIG;
    const openclawJson = this.hydrateOpenclawConfig(
      openclawConfigTemplate,
      context,
    );

    this.logger.debug(
      `Generated workspace for agent ${options.agent.id} (role=${options.agent.role})`,
    );

    return {
      soulMd,
      agentsMd,
      userMd,
      heartbeatMd,
      identityMd,
      openclawJson,
    };
  }

  /**
   * Replace all `{{key}}` placeholders in a template string with values
   * from the context record.
   */
  hydrateTemplate(
    template: string,
    context: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }

  /**
   * Build the full template context record from the generation options.
   * Contains all available placeholders for template hydration.
   */
  private buildContext(
    options: GenerateWorkspaceOptions,
  ): Record<string, string> {
    const { agent, tenant, roleConfig } = options;

    const toolCategories = Array.isArray(roleConfig.defaultToolCategories)
      ? roleConfig.defaultToolCategories.join(', ')
      : '';

    return {
      agentName: agent.name,
      tenantName: tenant.companyName,
      personality: agent.personality ?? '',
      agentRole: roleConfig.label || agent.role,
      modelTier: agent.modelTier,
      identityEmoji: roleConfig.identityEmoji ?? 'robot',
      toolCategories,
      modelName: MODEL_MAP[agent.modelTier] ?? agent.modelTier,
      thinkingLevel: THINKING_MAP[agent.thinkingMode] ?? agent.thinkingMode,
      temperature: String(agent.temperature),
    };
  }

  /**
   * Hydrate an OpenClaw config JSON object by replacing string-valued
   * `{{key}}` placeholders in all leaf values.
   */
  private hydrateOpenclawConfig(
    template: Record<string, unknown>,
    context: Record<string, string>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        result[key] = this.hydrateTemplate(value, context);
      } else if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        result[key] = this.hydrateOpenclawConfig(
          value as Record<string, unknown>,
          context,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}
