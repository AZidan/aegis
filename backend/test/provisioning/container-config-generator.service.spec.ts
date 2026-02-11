import { Test, TestingModule } from '@nestjs/testing';
import {
  ContainerConfigGeneratorService,
  GenerateWorkspaceOptions,
} from '../../src/provisioning/container-config-generator.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const createMockAgent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'agent-uuid-1',
  name: 'Support Bot',
  role: 'support',
  modelTier: 'sonnet',
  thinkingMode: 'standard',
  temperature: 0.3,
  personality: 'Friendly and helpful',
  toolPolicy: { allow: ['web_search'] },
  customTemplates: null,
  ...overrides,
});

const createMockTenant = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'tenant-uuid-1',
  companyName: 'Acme Corp',
  plan: 'growth',
  ...overrides,
});

const createMockRoleConfig = (overrides: Partial<Record<string, unknown>> = {}) => ({
  name: 'support',
  label: 'Customer Support',
  defaultToolCategories: ['web_search', 'knowledge_base'],
  identityEmoji: 'headphones',
  soulTemplate: '# {{agentName}} Soul\nYou are {{agentRole}} for {{tenantName}}.',
  agentsTemplate: '# {{agentName}} Agents\nModel: {{modelName}}\nThinking: {{thinkingLevel}}',
  heartbeatTemplate: '# {{agentName}} Heartbeat\nPersonality: {{personality}}',
  userTemplate: '# {{agentName}} User Guide\nTools: {{toolCategories}}',
  openclawConfigTemplate: null,
  ...overrides,
});

const buildOptions = (overrides: Partial<GenerateWorkspaceOptions> = {}): GenerateWorkspaceOptions => ({
  agent: createMockAgent() as GenerateWorkspaceOptions['agent'],
  tenant: createMockTenant() as GenerateWorkspaceOptions['tenant'],
  roleConfig: createMockRoleConfig() as GenerateWorkspaceOptions['roleConfig'],
  customTemplates: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: ContainerConfigGeneratorService
// ---------------------------------------------------------------------------
describe('ContainerConfigGeneratorService', () => {
  let service: ContainerConfigGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContainerConfigGeneratorService],
    }).compile();

    service = module.get<ContainerConfigGeneratorService>(
      ContainerConfigGeneratorService,
    );
  });

  // =========================================================================
  // hydrateTemplate
  // =========================================================================
  describe('hydrateTemplate', () => {
    it('should replace all {{placeholders}} correctly', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!';
      const context = { name: 'Alice', company: 'Acme' };

      const result = service.hydrateTemplate(template, context);

      expect(result).toBe('Hello Alice, welcome to Acme!');
    });

    it('should leave unmatched placeholders intact', () => {
      const template = 'Hello {{name}}, your role is {{role}}';
      const context = { name: 'Alice' };

      const result = service.hydrateTemplate(template, context);

      expect(result).toBe('Hello Alice, your role is {{role}}');
    });

    it('should handle special characters in agent name without breaking hydration', () => {
      const template = '# {{agentName}} Configuration';
      const context = { agentName: 'Bot (v2.0) & "Friends"' };

      const result = service.hydrateTemplate(template, context);

      expect(result).toBe('# Bot (v2.0) & "Friends" Configuration');
    });

    it('should hydrate cleanly when personality field is empty', () => {
      const template = 'Personality: {{personality}}\nRole: {{agentRole}}';
      const context = { personality: '', agentRole: 'Support' };

      const result = service.hydrateTemplate(template, context);

      expect(result).toBe('Personality: \nRole: Support');
    });
  });

  // =========================================================================
  // MODEL_MAP
  // =========================================================================
  describe('MODEL_MAP', () => {
    it('should map haiku to claude-haiku-4-5', () => {
      expect(ContainerConfigGeneratorService.MODEL_MAP['haiku']).toBe(
        'claude-haiku-4-5',
      );
    });

    it('should map sonnet to claude-sonnet-4-5', () => {
      expect(ContainerConfigGeneratorService.MODEL_MAP['sonnet']).toBe(
        'claude-sonnet-4-5',
      );
    });

    it('should map opus to claude-opus-4-5', () => {
      expect(ContainerConfigGeneratorService.MODEL_MAP['opus']).toBe(
        'claude-opus-4-5',
      );
    });
  });

  // =========================================================================
  // THINKING_MAP
  // =========================================================================
  describe('THINKING_MAP', () => {
    it('should map fast to off', () => {
      expect(ContainerConfigGeneratorService.THINKING_MAP['fast']).toBe('off');
    });

    it('should map standard to medium', () => {
      expect(ContainerConfigGeneratorService.THINKING_MAP['standard']).toBe(
        'medium',
      );
    });

    it('should map extended to high', () => {
      expect(ContainerConfigGeneratorService.THINKING_MAP['extended']).toBe(
        'high',
      );
    });
  });

  // =========================================================================
  // generateWorkspace
  // =========================================================================
  describe('generateWorkspace', () => {
    it('should return all 6 file types', () => {
      const workspace = service.generateWorkspace(buildOptions());

      expect(workspace).toHaveProperty('soulMd');
      expect(workspace).toHaveProperty('agentsMd');
      expect(workspace).toHaveProperty('userMd');
      expect(workspace).toHaveProperty('heartbeatMd');
      expect(workspace).toHaveProperty('identityMd');
      expect(workspace).toHaveProperty('openclawJson');
      expect(Object.keys(workspace)).toHaveLength(6);
    });

    it('should fall back to generic template when role config has null template fields', () => {
      const options = buildOptions({
        roleConfig: createMockRoleConfig({
          soulTemplate: null,
          agentsTemplate: null,
          heartbeatTemplate: null,
          userTemplate: null,
        }) as GenerateWorkspaceOptions['roleConfig'],
      });

      const workspace = service.generateWorkspace(options);

      // Generic template format: "# {{agentName}}\n\nRole: {{agentRole}}\nTenant: {{tenantName}}\nModel: {{modelName}}\n"
      expect(workspace.soulMd).toContain('Support Bot');
      expect(workspace.soulMd).toContain('Acme Corp');
      expect(workspace.soulMd).toContain('Customer Support');
      expect(workspace.soulMd).toContain('claude-sonnet-4-5');
    });

    it('should give custom template overrides precedence over role defaults', () => {
      const options = buildOptions({
        customTemplates: {
          soulTemplate: 'Custom soul: {{agentName}}',
        },
      });

      const workspace = service.generateWorkspace(options);

      expect(workspace.soulMd).toBe('Custom soul: Support Bot');
      // agentsMd should still use the role config template
      expect(workspace.agentsMd).toContain('Support Bot Agents');
    });

    it('should generate identityMd with correct format', () => {
      const workspace = service.generateWorkspace(buildOptions());

      expect(workspace.identityMd).toContain('# Identity');
      expect(workspace.identityMd).toContain(':headphones:');
      expect(workspace.identityMd).toContain('Role: Customer Support');
      expect(workspace.identityMd).toContain('Name: Support Bot');
    });

    it('should hydrate openclawJson correctly with default template', () => {
      const options = buildOptions({
        roleConfig: createMockRoleConfig({
          openclawConfigTemplate: null,
        }) as GenerateWorkspaceOptions['roleConfig'],
      });

      const workspace = service.generateWorkspace(options);

      expect(workspace.openclawJson).toEqual({
        model: 'claude-sonnet-4-5',
        thinking: 'medium',
        temperature: '0.3',
      });
    });

    it('should hydrate openclawJson with custom config template', () => {
      const options = buildOptions({
        roleConfig: createMockRoleConfig({
          openclawConfigTemplate: {
            model: '{{modelName}}',
            thinking: '{{thinkingLevel}}',
            agent: {
              name: '{{agentName}}',
              role: '{{agentRole}}',
            },
          },
        }) as GenerateWorkspaceOptions['roleConfig'],
      });

      const workspace = service.generateWorkspace(options);

      expect(workspace.openclawJson).toEqual({
        model: 'claude-sonnet-4-5',
        thinking: 'medium',
        agent: {
          name: 'Support Bot',
          role: 'Customer Support',
        },
      });
    });

    it('should handle missing role config fields gracefully', () => {
      const options = buildOptions({
        roleConfig: {
          name: 'custom',
          label: '',
          defaultToolCategories: [],
          identityEmoji: null,
          soulTemplate: null,
          agentsTemplate: null,
          heartbeatTemplate: null,
          userTemplate: null,
          openclawConfigTemplate: null,
        },
        agent: createMockAgent({ role: 'custom' }) as GenerateWorkspaceOptions['agent'],
      });

      const workspace = service.generateWorkspace(options);

      // Should use generic template and not throw
      expect(workspace.soulMd).toBeDefined();
      expect(workspace.identityMd).toContain(':robot:');
    });

    it('should produce comma-separated list for toolCategories', () => {
      const options = buildOptions({
        roleConfig: createMockRoleConfig({
          soulTemplate: 'Tools: {{toolCategories}}',
          defaultToolCategories: ['web_search', 'knowledge_base', 'code_exec'],
        }) as GenerateWorkspaceOptions['roleConfig'],
      });

      const workspace = service.generateWorkspace(options);

      expect(workspace.soulMd).toBe(
        'Tools: web_search, knowledge_base, code_exec',
      );
    });
  });
});
