import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { TenantsController } from '../../src/admin/tenants/tenants.controller';
import { TenantsService } from '../../src/admin/tenants/tenants.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
const mockPlatformAdmin = {
  id: 'admin-uuid',
  role: 'platform_admin',
  email: 'admin@aegis.ai',
};

const mockTenantAdmin = {
  id: 'tenant-uuid',
  role: 'tenant_admin',
  email: 'tenant@acme.com',
};

const mockTenantListResponse = {
  data: [
    {
      id: 'tenant-uuid-1',
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      status: 'active' as const,
      plan: 'growth' as const,
      agentCount: 5,
      createdAt: '2026-01-15T10:00:00.000Z',
    },
    {
      id: 'tenant-uuid-2',
      companyName: 'Beta Inc',
      adminEmail: 'admin@beta.com',
      status: 'provisioning' as const,
      plan: 'starter' as const,
      agentCount: 0,
      createdAt: '2026-02-01T08:30:00.000Z',
    },
  ],
  meta: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  },
};

const mockTenantListWithHealth = {
  data: [
    {
      id: 'tenant-uuid-1',
      companyName: 'Acme Corp',
      adminEmail: 'admin@acme.com',
      status: 'active' as const,
      plan: 'growth' as const,
      agentCount: 5,
      health: {
        status: 'healthy' as const,
        cpu: 45,
        memory: 62,
        disk: 30,
      },
      createdAt: '2026-01-15T10:00:00.000Z',
    },
  ],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

const mockCreateTenantResponse = {
  id: 'new-tenant-uuid',
  companyName: 'New Company',
  adminEmail: 'admin@newcompany.com',
  status: 'provisioning' as const,
  inviteLink: 'https://app.aegis.ai/invite/abc123',
  createdAt: '2026-02-05T12:00:00.000Z',
};

const mockTenantDetailResponse = {
  id: 'tenant-uuid-1',
  companyName: 'Acme Corp',
  adminEmail: 'admin@acme.com',
  status: 'active' as const,
  plan: 'growth' as const,
  agentCount: 5,
  containerHealth: {
    status: 'healthy' as const,
    cpu: 45,
    memory: 62,
    disk: 30,
    uptime: 864000,
    lastHealthCheck: '2026-02-05T12:00:00.000Z',
  },
  resourceLimits: {
    cpuCores: 4,
    memoryMb: 8192,
    diskGb: 50,
    maxAgents: 10,
  },
  config: {
    modelDefaults: {
      tier: 'sonnet',
      thinkingMode: 'low',
    },
    containerEndpoint: 'https://tenant-uuid-1.containers.aegis.ai',
  },
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-02-05T12:00:00.000Z',
};

const mockUpdateTenantResponse = {
  id: 'tenant-uuid-1',
  companyName: 'Acme Corp',
  plan: 'enterprise',
  resourceLimits: {
    cpuCores: 8,
    memoryMb: 16384,
    diskGb: 100,
    maxAgents: 50,
  },
  modelDefaults: {
    tier: 'opus',
    thinkingMode: 'high',
  },
  updatedAt: '2026-02-05T14:00:00.000Z',
};

const mockDeleteTenantResponse = {
  id: 'tenant-uuid-1',
  status: 'pending_deletion' as const,
  gracePeriodEnds: '2026-02-12T12:00:00.000Z',
  message: 'Tenant scheduled for deletion. Permanent deletion on 2026-02-12',
};

const mockRestartContainerResponse = {
  message: 'Container restart initiated',
  tenantId: 'tenant-uuid-1',
  estimatedDowntime: 45,
};

const mockContainerHealthResponse = {
  current: {
    status: 'healthy' as const,
    cpu: 45,
    memory: 62,
    disk: 30,
    uptime: 864000,
    timestamp: '2026-02-05T12:00:00.000Z',
  },
  history24h: [
    {
      timestamp: '2026-02-04T12:00:00.000Z',
      cpu: 40,
      memory: 58,
      disk: 29,
      status: 'healthy',
    },
    {
      timestamp: '2026-02-04T12:05:00.000Z',
      cpu: 42,
      memory: 60,
      disk: 29,
      status: 'healthy',
    },
  ],
};

const mockTenantAgentsResponse = {
  data: [
    {
      id: 'agent-uuid-1',
      name: 'Project Manager Bot',
      role: 'pm' as const,
      status: 'active' as const,
      modelTier: 'sonnet' as const,
      lastActive: '2026-02-05T11:30:00.000Z',
      createdAt: '2026-01-20T09:00:00.000Z',
    },
    {
      id: 'agent-uuid-2',
      name: 'Engineering Bot',
      role: 'engineering' as const,
      status: 'idle' as const,
      modelTier: 'opus' as const,
      lastActive: '2026-02-04T16:00:00.000Z',
      createdAt: '2026-01-22T10:00:00.000Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// Test Suite: TenantsController
// ---------------------------------------------------------------------------
describe('TenantsController', () => {
  let controller: TenantsController;
  let tenantsService: {
    listTenants: jest.Mock;
    createTenant: jest.Mock;
    getTenantDetail: jest.Mock;
    updateTenantConfig: jest.Mock;
    deleteTenant: jest.Mock;
    restartContainer: jest.Mock;
    getTenantHealth: jest.Mock;
    getTenantAgents: jest.Mock;
  };

  beforeEach(async () => {
    tenantsService = {
      listTenants: jest.fn(),
      createTenant: jest.fn(),
      getTenantDetail: jest.fn(),
      updateTenantConfig: jest.fn(),
      deleteTenant: jest.fn(),
      restartContainer: jest.fn(),
      getTenantHealth: jest.fn(),
      getTenantAgents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [{ provide: TenantsService, useValue: tenantsService }],
    })
      // Override the JwtAuthGuard to always pass for controller unit tests
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TenantsController>(TenantsController);
  });

  // =========================================================================
  // GET /api/admin/tenants
  // =========================================================================
  describe('GET /admin/tenants', () => {
    it('should return paginated tenant list with meta', async () => {
      // Arrange
      tenantsService.listTenants.mockResolvedValue(mockTenantListResponse);

      // Act
      const result = await controller.listTenants(
        mockPlatformAdmin,
        { page: 1, limit: 20 },
      );

      // Assert - matches API contract Section 3 List Tenants response
      expect(result).toEqual(mockTenantListResponse);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });

    it('should pass query params to service for filtering', async () => {
      // Arrange
      tenantsService.listTenants.mockResolvedValue(mockTenantListResponse);
      const query = {
        page: 2,
        limit: 10,
        status: 'active' as const,
        plan: 'growth' as const,
        health: 'healthy' as const,
        search: 'Acme',
        sort: 'company_name:asc' as const,
      };

      // Act
      await controller.listTenants(mockPlatformAdmin, query);

      // Assert
      expect(tenantsService.listTenants).toHaveBeenCalledWith(query);
    });

    it('should return tenant list with health data when include=health', async () => {
      // Arrange
      tenantsService.listTenants.mockResolvedValue(mockTenantListWithHealth);
      const query = { page: 1, limit: 20, include: 'health' as const };

      // Act
      const result = await controller.listTenants(mockPlatformAdmin, query);

      // Assert
      expect(result.data[0].health).toBeDefined();
      expect(result.data[0].health).toEqual({
        status: 'healthy',
        cpu: 45,
        memory: 62,
        disk: 30,
      });
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Arrange
      tenantsService.listTenants.mockResolvedValue(mockTenantListResponse);

      // Act & Assert
      await expect(
        controller.listTenants(mockTenantAdmin, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.listTenants(mockTenantAdmin, { page: 1, limit: 20 }),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should pass sorting parameters to service', async () => {
      // Arrange
      tenantsService.listTenants.mockResolvedValue(mockTenantListResponse);
      const query = { page: 1, limit: 20, sort: 'created_at:desc' as const };

      // Act
      await controller.listTenants(mockPlatformAdmin, query);

      // Assert
      expect(tenantsService.listTenants).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'created_at:desc' }),
      );
    });

    it('should support agent_count sorting', async () => {
      // Arrange
      tenantsService.listTenants.mockResolvedValue(mockTenantListResponse);
      const query = { page: 1, limit: 20, sort: 'agent_count:desc' as const };

      // Act
      await controller.listTenants(mockPlatformAdmin, query);

      // Assert
      expect(tenantsService.listTenants).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'agent_count:desc' }),
      );
    });
  });

  // =========================================================================
  // POST /api/admin/tenants
  // =========================================================================
  describe('POST /admin/tenants', () => {
    it('should create tenant and return 201 with provisioning status and inviteLink', async () => {
      // Arrange
      tenantsService.createTenant.mockResolvedValue(mockCreateTenantResponse);
      const dto = {
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        plan: 'growth' as const,
      };

      // Act
      const result = await controller.createTenant(mockPlatformAdmin, dto);

      // Assert - matches API contract Section 3 Create Tenant response
      expect(result).toEqual(mockCreateTenantResponse);
      expect(result.status).toBe('provisioning');
      expect(result.inviteLink).toBeDefined();
      expect(tenantsService.createTenant).toHaveBeenCalledWith(dto);
    });

    it('should pass optional fields to service when provided', async () => {
      // Arrange
      tenantsService.createTenant.mockResolvedValue(mockCreateTenantResponse);
      const dto = {
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        plan: 'enterprise' as const,
        industry: 'Technology',
        expectedAgentCount: 15,
        modelDefaults: {
          tier: 'opus' as const,
          thinkingMode: 'high' as const,
        },
        resourceLimits: {
          cpuCores: 8,
          memoryMb: 16384,
          diskGb: 100,
          maxAgents: 50,
        },
      };

      // Act
      await controller.createTenant(mockPlatformAdmin, dto);

      // Assert
      expect(tenantsService.createTenant).toHaveBeenCalledWith(dto);
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Arrange
      const dto = {
        companyName: 'New Company',
        adminEmail: 'admin@newcompany.com',
        plan: 'starter' as const,
      };

      // Act & Assert
      await expect(
        controller.createTenant(mockTenantAdmin, dto),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.createTenant(mockTenantAdmin, dto),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should propagate ConflictException for duplicate companyName', async () => {
      // Arrange
      tenantsService.createTenant.mockRejectedValue(
        new ConflictException('Company name already exists'),
      );
      const dto = {
        companyName: 'Acme Corp',
        adminEmail: 'admin@acme2.com',
        plan: 'starter' as const,
      };

      // Act & Assert
      await expect(
        controller.createTenant(mockPlatformAdmin, dto),
      ).rejects.toThrow(ConflictException);

      await expect(
        controller.createTenant(mockPlatformAdmin, dto),
      ).rejects.toThrow('Company name already exists');
    });
  });

  // =========================================================================
  // GET /api/admin/tenants/:id
  // =========================================================================
  describe('GET /admin/tenants/:id', () => {
    it('should return tenant detail with containerHealth, resourceLimits, and config', async () => {
      // Arrange
      tenantsService.getTenantDetail.mockResolvedValue(mockTenantDetailResponse);

      // Act
      const result = await controller.getTenantDetail(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert - matches API contract Section 3 Get Tenant Detail response
      expect(result).toEqual(mockTenantDetailResponse);
      expect(result.containerHealth).toBeDefined();
      expect(result.containerHealth.status).toBe('healthy');
      expect(result.resourceLimits).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.config.modelDefaults).toBeDefined();
      expect(result.config.containerEndpoint).toBeDefined();
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      tenantsService.getTenantDetail.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      // Act & Assert
      await expect(
        controller.getTenantDetail(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.getTenantDetail(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Act & Assert
      await expect(
        controller.getTenantDetail(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getTenantDetail(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should call service with correct tenant id', async () => {
      // Arrange
      tenantsService.getTenantDetail.mockResolvedValue(mockTenantDetailResponse);

      // Act
      await controller.getTenantDetail(mockPlatformAdmin, 'tenant-uuid-1');

      // Assert
      expect(tenantsService.getTenantDetail).toHaveBeenCalledWith('tenant-uuid-1');
    });
  });

  // =========================================================================
  // PATCH /api/admin/tenants/:id
  // =========================================================================
  describe('PATCH /admin/tenants/:id', () => {
    it('should update tenant and return updated data', async () => {
      // Arrange
      tenantsService.updateTenantConfig.mockResolvedValue(mockUpdateTenantResponse);
      const dto = {
        plan: 'enterprise' as const,
        resourceLimits: {
          cpuCores: 8,
          memoryMb: 16384,
          diskGb: 100,
          maxAgents: 50,
        },
        modelDefaults: {
          tier: 'opus' as const,
          thinkingMode: 'high' as const,
        },
      };

      // Act
      const result = await controller.updateTenantConfig(
        mockPlatformAdmin,
        'tenant-uuid-1',
        dto,
      );

      // Assert - matches API contract Section 3 Update Tenant Config response
      expect(result).toEqual(mockUpdateTenantResponse);
      expect(result.plan).toBe('enterprise');
      expect(result.updatedAt).toBeDefined();
    });

    it('should allow partial updates (plan only)', async () => {
      // Arrange
      const partialResponse = {
        ...mockUpdateTenantResponse,
        plan: 'growth',
      };
      tenantsService.updateTenantConfig.mockResolvedValue(partialResponse);
      const dto = { plan: 'growth' as const };

      // Act
      await controller.updateTenantConfig(mockPlatformAdmin, 'tenant-uuid-1', dto);

      // Assert
      expect(tenantsService.updateTenantConfig).toHaveBeenCalledWith(
        'tenant-uuid-1',
        dto,
      );
    });

    it('should allow partial updates (modelDefaults only)', async () => {
      // Arrange
      tenantsService.updateTenantConfig.mockResolvedValue(mockUpdateTenantResponse);
      const dto = {
        modelDefaults: {
          tier: 'haiku' as const,
          thinkingMode: 'off' as const,
        },
      };

      // Act
      await controller.updateTenantConfig(mockPlatformAdmin, 'tenant-uuid-1', dto);

      // Assert
      expect(tenantsService.updateTenantConfig).toHaveBeenCalledWith(
        'tenant-uuid-1',
        dto,
      );
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      tenantsService.updateTenantConfig.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );
      const dto = { plan: 'enterprise' as const };

      // Act & Assert
      await expect(
        controller.updateTenantConfig(mockPlatformAdmin, 'nonexistent-uuid', dto),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.updateTenantConfig(mockPlatformAdmin, 'nonexistent-uuid', dto),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Arrange
      const dto = { plan: 'enterprise' as const };

      // Act & Assert
      await expect(
        controller.updateTenantConfig(mockTenantAdmin, 'tenant-uuid-1', dto),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.updateTenantConfig(mockTenantAdmin, 'tenant-uuid-1', dto),
      ).rejects.toThrow('Requires platform_admin role');
    });
  });

  // =========================================================================
  // DELETE /api/admin/tenants/:id
  // =========================================================================
  describe('DELETE /admin/tenants/:id', () => {
    it('should soft delete tenant and return 200 with gracePeriodEnds', async () => {
      // Arrange
      tenantsService.deleteTenant.mockResolvedValue(mockDeleteTenantResponse);

      // Act
      const result = await controller.deleteTenant(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert - matches API contract Section 3 Delete Tenant response
      expect(result).toEqual(mockDeleteTenantResponse);
      expect(result.status).toBe('pending_deletion');
      expect(result.gracePeriodEnds).toBeDefined();
      expect(result.message).toContain('Tenant scheduled for deletion');
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      tenantsService.deleteTenant.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      // Act & Assert
      await expect(
        controller.deleteTenant(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.deleteTenant(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Act & Assert
      await expect(
        controller.deleteTenant(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.deleteTenant(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should call service with correct tenant id', async () => {
      // Arrange
      tenantsService.deleteTenant.mockResolvedValue(mockDeleteTenantResponse);

      // Act
      await controller.deleteTenant(mockPlatformAdmin, 'tenant-uuid-1');

      // Assert
      expect(tenantsService.deleteTenant).toHaveBeenCalledWith('tenant-uuid-1');
    });
  });

  // =========================================================================
  // POST /api/admin/tenants/:id/actions/restart
  // =========================================================================
  describe('POST /admin/tenants/:id/actions/restart', () => {
    it('should restart container and return 202 with estimatedDowntime', async () => {
      // Arrange
      tenantsService.restartContainer.mockResolvedValue(
        mockRestartContainerResponse,
      );

      // Act
      const result = await controller.restartContainer(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert - matches API contract Section 3 Restart Container response
      expect(result).toEqual(mockRestartContainerResponse);
      expect(result.message).toBe('Container restart initiated');
      expect(result.tenantId).toBe('tenant-uuid-1');
      expect(result.estimatedDowntime).toBeDefined();
      expect(typeof result.estimatedDowntime).toBe('number');
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      tenantsService.restartContainer.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      // Act & Assert
      await expect(
        controller.restartContainer(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.restartContainer(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Act & Assert
      await expect(
        controller.restartContainer(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.restartContainer(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should call service with correct tenant id', async () => {
      // Arrange
      tenantsService.restartContainer.mockResolvedValue(
        mockRestartContainerResponse,
      );

      // Act
      await controller.restartContainer(mockPlatformAdmin, 'tenant-uuid-1');

      // Assert
      expect(tenantsService.restartContainer).toHaveBeenCalledWith('tenant-uuid-1');
    });
  });

  // =========================================================================
  // GET /api/admin/tenants/:id/health
  // =========================================================================
  describe('GET /admin/tenants/:id/health', () => {
    it('should return current health and 24h history', async () => {
      // Arrange
      tenantsService.getTenantHealth.mockResolvedValue(
        mockContainerHealthResponse,
      );

      // Act
      const result = await controller.getTenantHealth(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert - matches API contract Section 3 Container Health response
      expect(result).toEqual(mockContainerHealthResponse);
      expect(result.current).toBeDefined();
      expect(result.current.status).toBe('healthy');
      expect(result.current.cpu).toBeDefined();
      expect(result.current.memory).toBeDefined();
      expect(result.current.disk).toBeDefined();
      expect(result.current.uptime).toBeDefined();
      expect(result.current.timestamp).toBeDefined();
      expect(result.history24h).toBeDefined();
      expect(Array.isArray(result.history24h)).toBe(true);
      expect(result.history24h.length).toBeGreaterThan(0);
    });

    it('should return history data points with correct shape', async () => {
      // Arrange
      tenantsService.getTenantHealth.mockResolvedValue(
        mockContainerHealthResponse,
      );

      // Act
      const result = await controller.getTenantHealth(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert - each history data point has correct fields
      const historyPoint = result.history24h[0];
      expect(historyPoint).toHaveProperty('timestamp');
      expect(historyPoint).toHaveProperty('cpu');
      expect(historyPoint).toHaveProperty('memory');
      expect(historyPoint).toHaveProperty('disk');
      expect(historyPoint).toHaveProperty('status');
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      tenantsService.getTenantHealth.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      // Act & Assert
      await expect(
        controller.getTenantHealth(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.getTenantHealth(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Act & Assert
      await expect(
        controller.getTenantHealth(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getTenantHealth(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow('Requires platform_admin role');
    });
  });

  // =========================================================================
  // GET /api/admin/tenants/:id/agents
  // =========================================================================
  describe('GET /admin/tenants/:id/agents', () => {
    it('should return agents array with correct data shape', async () => {
      // Arrange
      tenantsService.getTenantAgents.mockResolvedValue(
        mockTenantAgentsResponse,
      );

      // Act
      const result = await controller.getTenantAgents(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert - matches API contract Section 3 Get Tenant Agents response
      expect(result).toEqual(mockTenantAgentsResponse);
      expect(result.data).toHaveLength(2);

      const agent = result.data[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('role');
      expect(agent).toHaveProperty('status');
      expect(agent).toHaveProperty('modelTier');
      expect(agent).toHaveProperty('lastActive');
      expect(agent).toHaveProperty('createdAt');
    });

    it('should return agents with valid role values', async () => {
      // Arrange
      tenantsService.getTenantAgents.mockResolvedValue(
        mockTenantAgentsResponse,
      );

      // Act
      const result = await controller.getTenantAgents(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert
      const validRoles = ['pm', 'engineering', 'operations', 'custom'];
      result.data.forEach((agent: { role: string }) => {
        expect(validRoles).toContain(agent.role);
      });
    });

    it('should return agents with valid status values', async () => {
      // Arrange
      tenantsService.getTenantAgents.mockResolvedValue(
        mockTenantAgentsResponse,
      );

      // Act
      const result = await controller.getTenantAgents(
        mockPlatformAdmin,
        'tenant-uuid-1',
      );

      // Assert
      const validStatuses = ['active', 'idle', 'error'];
      result.data.forEach((agent: { status: string }) => {
        expect(validStatuses).toContain(agent.status);
      });
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      tenantsService.getTenantAgents.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      // Act & Assert
      await expect(
        controller.getTenantAgents(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.getTenantAgents(mockPlatformAdmin, 'nonexistent-uuid'),
      ).rejects.toThrow('Tenant not found');
    });

    it('should throw ForbiddenException for non-platform_admin role', async () => {
      // Act & Assert
      await expect(
        controller.getTenantAgents(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getTenantAgents(mockTenantAdmin, 'tenant-uuid-1'),
      ).rejects.toThrow('Requires platform_admin role');
    });

    it('should call service with correct tenant id', async () => {
      // Arrange
      tenantsService.getTenantAgents.mockResolvedValue(
        mockTenantAgentsResponse,
      );

      // Act
      await controller.getTenantAgents(mockPlatformAdmin, 'tenant-uuid-1');

      // Assert
      expect(tenantsService.getTenantAgents).toHaveBeenCalledWith('tenant-uuid-1');
    });
  });

  // =========================================================================
  // HTTP Status Code Configuration
  // =========================================================================
  describe('HTTP Status Code Configuration', () => {
    it('should configure 200 OK for GET /admin/tenants (listTenants)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.listTenants,
      );
      // Default GET is 200, may or may not have explicit decorator
      expect(statusCode === HttpStatus.OK || statusCode === undefined).toBe(true);
    });

    it('should configure 201 CREATED for POST /admin/tenants (createTenant)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.createTenant,
      );
      expect(statusCode).toBe(HttpStatus.CREATED);
    });

    it('should configure 200 OK for GET /admin/tenants/:id (getTenantDetail)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.getTenantDetail,
      );
      expect(statusCode === HttpStatus.OK || statusCode === undefined).toBe(true);
    });

    it('should configure 200 OK for PATCH /admin/tenants/:id (updateTenant)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.updateTenantConfig,
      );
      expect(statusCode === HttpStatus.OK || statusCode === undefined).toBe(true);
    });

    it('should configure 200 OK for DELETE /admin/tenants/:id (deleteTenant)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.deleteTenant,
      );
      expect(statusCode === HttpStatus.OK || statusCode === undefined).toBe(true);
    });

    it('should configure 202 ACCEPTED for POST /admin/tenants/:id/actions/restart (restartContainer)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.restartContainer,
      );
      expect(statusCode).toBe(HttpStatus.ACCEPTED);
    });

    it('should configure 200 OK for GET /admin/tenants/:id/health (getContainerHealth)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.getTenantHealth,
      );
      expect(statusCode === HttpStatus.OK || statusCode === undefined).toBe(true);
    });

    it('should configure 200 OK for GET /admin/tenants/:id/agents (getTenantAgents)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        TenantsController.prototype.getTenantAgents,
      );
      expect(statusCode === HttpStatus.OK || statusCode === undefined).toBe(true);
    });
  });

  // =========================================================================
  // Guard Configuration Verification
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard applied to the controller', () => {
      // Check controller-level guard metadata
      const guards = Reflect.getMetadata('__guards__', TenantsController);
      // The guard should be applied either at controller level or on each method
      if (guards) {
        expect(guards.length).toBeGreaterThan(0);
      } else {
        // If not at controller level, check that individual methods have guards
        const methodNames = [
          'listTenants',
          'createTenant',
          'getTenantDetail',
          'updateTenantConfig',
          'deleteTenant',
          'restartContainer',
          'getTenantHealth',
          'getTenantAgents',
        ];

        const allMethodsGuarded = methodNames.every((method) => {
          const methodGuards = Reflect.getMetadata(
            '__guards__',
            TenantsController.prototype[method as keyof TenantsController],
          );
          return methodGuards && methodGuards.length > 0;
        });

        expect(allMethodsGuarded).toBe(true);
      }
    });
  });
});
