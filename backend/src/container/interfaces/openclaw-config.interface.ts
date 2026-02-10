export interface OpenClawGatewayConfig {
  bind: 'lan' | 'localhost';
  port: number;
  auth: {
    mode: 'token';
    token: string;
  };
  controlUi: {
    enabled: boolean;
  };
}

export interface OpenClawAgentConfig {
  model: {
    tier: string;
    temperature: number;
    thinkingMode: string;
  };
  tools: {
    allow: string[];
    deny: string[];
  };
  sandbox: {
    mode: 'all' | 'none';
  };
  workspace: string;
}

export interface OpenClawConfig {
  gateway: OpenClawGatewayConfig;
  agents: {
    defaults: {
      sandbox: {
        mode: 'all';
        scope: 'agent';
        workspaceAccess: 'ro' | 'rw';
      };
      tools: {
        sandbox: {
          denyPaths: string[];
        };
      };
    };
    list: Record<string, OpenClawAgentConfig>;
  };
  bindings: Array<{
    agentId: string;
    match: {
      channel: string;
      accountId: string;
      routeType: string;
      sourceIdentifier: string;
    };
  }>;
  channels: Record<
    string,
    {
      connectionId: string;
      workspaceId: string;
      workspaceName: string;
      dmPolicy: 'allowlist';
    }
  >;
  messaging: {
    allowlist: Record<string, string[]>;
  };
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
