export interface OpenClawGatewayConfig {
  mode: 'local' | 'tailscale';
  bind: 'lan' | 'localhost';
  port: number;
  auth: {
    mode: 'token';
    token: string;
  };
  controlUi: {
    enabled: boolean;
  };
  http?: {
    endpoints?: {
      responses?: { enabled: boolean };
    };
  };
}

export interface OpenClawAgentConfig {
  id: string;
  workspace?: string;
  identity?: {
    name: string;
    emoji?: string;
  };
  tools: {
    profile?: string;
    allow?: string[];
    deny?: string[];
  };
  subagents?: {
    allowAgents?: string[];
  };
}

export interface OpenClawConfig {
  gateway: OpenClawGatewayConfig;
  hooks?: {
    enabled: boolean;
    token: string;
  };
  agents: {
    defaults: {
      workspace: string;
      maxConcurrent: number;
      model?: {
        primary: string;
      };
      compaction?: {
        mode: string;
      };
    };
    list: OpenClawAgentConfig[];
  };
  bindings: Array<{
    agentId: string;
    match: {
      channel: string;
      accountId: string;
    };
  }>;
  channels: Record<string, Record<string, unknown>>;
  skills: Record<
    string,
    Array<{
      skillId: string;
      name: string;
      version: string;
      category: string;
    }>
  >;
  logging: {
    redactSensitive: 'tools';
    redactPatterns: string[];
  };
  tools: {
    deny: string[];
    sandbox: {
      tools: {
        deny: string[];
      };
    };
  };
}
