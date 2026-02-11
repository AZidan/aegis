import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoleTemplatesController } from '../../../src/admin/role-templates/role-templates.controller';
import { PrismaService } from '../../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

const ROLE_CONFIG_ID = 'role-config-uuid-1';

const mockAdminUser = () => ({
  id: 'admin-uuid-1',
  role: 'platform_admin',
});

const mockNonAdminUser = () => ({
  id: 'user-uuid-1',
  role: 'tenant_admin',
});

const createMockRoleConfig = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: ROLE_CONFIG_ID,
  name: 'support',
  label: 'Customer Support',
  description: 'Support agents',
  color: '#3b82f6',
  defaultToolCategories: ['web_search', 'knowledge_base'],
  sortOrder: 1,
  isSystem: true,
  soulTemplate: '# {{agentName}} Soul\nRole: {{agentRole}}',
  agentsTemplate: '# {{agentName}} Agents\nModel: {{modelName}}',
  heartbeatTemplate: '# {{agentName}} Heartbeat',
  userTemplate: '# {{agentName}} User',
  identityEmoji: 'headphones',
  openclawConfigTemplate: { model: '{{modelName}}' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-15T00:00:00.000Z'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Test Suite: RoleTemplatesController
// ---------------------------------------------------------------------------
describe('RoleTemplatesController', () => {
  let controller: RoleTemplatesController;
  let prisma: {
    agentRoleConfig: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      agentRoleConfig: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleTemplatesController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<RoleTemplatesController>(
      RoleTemplatesController,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // GET /admin/role-configs
  // =========================================================================
  describe('listRoleConfigs', () => {
    it('should return all role configs with templates', async () => {
      const roleConfigs = [
        createMockRoleConfig(),
        createMockRoleConfig({ id: 'role-2', name: 'pm', label: 'Product Manager' }),
      ];
      prisma.agentRoleConfig.findMany.mockResolvedValue(roleConfigs);

      const result = await controller.listRoleConfigs(mockAdminUser());

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('name', 'support');
      expect(result.data[0]).toHaveProperty('soulTemplate');
      expect(result.data[0]).toHaveProperty('agentsTemplate');
      expect(result.data[0]).toHaveProperty('openclawConfigTemplate');
      expect(prisma.agentRoleConfig.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      await expect(
        controller.listRoleConfigs(mockNonAdminUser()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // GET /admin/role-configs/:id
  // =========================================================================
  describe('getRoleConfig', () => {
    it('should return single config', async () => {
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const result = await controller.getRoleConfig(
        ROLE_CONFIG_ID,
        mockAdminUser(),
      );

      expect(result.data).toHaveProperty('id', ROLE_CONFIG_ID);
      expect(result.data).toHaveProperty('name', 'support');
      expect(result.data).toHaveProperty('soulTemplate');
      expect(prisma.agentRoleConfig.findUnique).toHaveBeenCalledWith({
        where: { id: ROLE_CONFIG_ID },
      });
    });

    it('should throw 404 for non-existent id', async () => {
      prisma.agentRoleConfig.findUnique.mockResolvedValue(null);

      await expect(
        controller.getRoleConfig('nonexistent-id', mockAdminUser()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // PUT /admin/role-configs/:id
  // =========================================================================
  describe('updateRoleConfig', () => {
    it('should update template fields', async () => {
      const existing = createMockRoleConfig();
      prisma.agentRoleConfig.findUnique.mockResolvedValue(existing);

      const updatedConfig = createMockRoleConfig({
        soulTemplate: '# Updated Soul for {{agentName}}',
        updatedAt: new Date('2026-02-10T00:00:00.000Z'),
      });
      prisma.agentRoleConfig.update.mockResolvedValue(updatedConfig);

      const dto = { soulTemplate: '# Updated Soul for {{agentName}}' };
      const result = await controller.updateRoleConfig(
        ROLE_CONFIG_ID,
        dto,
        mockAdminUser(),
      );

      expect(result.data).toHaveProperty('soulTemplate', '# Updated Soul for {{agentName}}');
      expect(prisma.agentRoleConfig.update).toHaveBeenCalledWith({
        where: { id: ROLE_CONFIG_ID },
        data: expect.objectContaining({ soulTemplate: '# Updated Soul for {{agentName}}' }),
      });
    });

    it('should return 404 for non-existent id', async () => {
      prisma.agentRoleConfig.findUnique.mockResolvedValue(null);

      await expect(
        controller.updateRoleConfig(
          'nonexistent-id',
          { label: 'New Label' },
          mockAdminUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-admin user', async () => {
      await expect(
        controller.updateRoleConfig(
          ROLE_CONFIG_ID,
          { label: 'New Label' },
          mockNonAdminUser(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // POST /admin/role-configs/:id/preview
  // =========================================================================
  describe('previewTemplate', () => {
    it('should render template with sample data', async () => {
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig(),
      );

      const dto = {
        templateField: 'soulTemplate' as const,
        sampleData: {
          agentName: 'Test Bot',
          agentRole: 'Helper',
        },
      };

      const result = await controller.previewTemplate(
        ROLE_CONFIG_ID,
        dto,
        mockAdminUser(),
      );

      expect(result.rendered).toContain('Test Bot');
      expect(result.rendered).toContain('Helper');
    });

    it('should work with custom sample data', async () => {
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig({
          agentsTemplate: 'Agent {{agentName}} uses model {{modelName}}',
        }),
      );

      const dto = {
        templateField: 'agentsTemplate' as const,
        sampleData: {
          agentName: 'Custom Agent',
          modelName: 'claude-opus-4-5',
        },
      };

      const result = await controller.previewTemplate(
        ROLE_CONFIG_ID,
        dto,
        mockAdminUser(),
      );

      expect(result.rendered).toBe(
        'Agent Custom Agent uses model claude-opus-4-5',
      );
    });

    it('should return empty string when template field is null', async () => {
      prisma.agentRoleConfig.findUnique.mockResolvedValue(
        createMockRoleConfig({ heartbeatTemplate: null }),
      );

      const dto = {
        templateField: 'heartbeatTemplate' as const,
        sampleData: { agentName: 'Test' },
      };

      const result = await controller.previewTemplate(
        ROLE_CONFIG_ID,
        dto,
        mockAdminUser(),
      );

      expect(result.rendered).toBe('');
    });
  });
});
