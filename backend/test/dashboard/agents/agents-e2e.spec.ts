import { Test, TestingModule } from '@nestjs/testing';
import {
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AgentsController } from '../../../src/dashboard/agents/agents.controller';
import { AgentsService } from '../../../src/dashboard/agents/agents.service';
import { JwtAuthGuard } from '../../../src/auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../src/common/guards/tenant.guard';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
const TENANT_ID = 'tenant-uuid-1';
const AGENT_ID = 'agent-uuid-1';

const mockRequest = {
  tenantId: TENANT_ID,
  user: {
    sub: 'user-uuid-1',
    email: 'admin@acme.com',
    role: 'tenant_admin',
    tenantId: TENANT_ID,
    permissions: ['agent:create', 'agent:read', 'agent:update', 'agent:delete'],
  },
} as any;

const mockCreateResponse = {
  id: AGENT_ID,
  name: 'New Agent',
  role: 'pm',
  status: 'provisioning',
  modelTier: 'sonnet',
  thinkingMode: 'standard',
  createdAt: '2026-02-05T12:00:00.000Z',
};

const mockListResponse = {
  data: [
    {
      id: AGENT_ID,
      name: 'PM Bot',
      role: 'pm',
      status: 'active',
      modelTier: 'sonnet',
      thinkingMode: 'standard',
      temperature: 0.3,
      avatarColor: '#6366f1',
      lastActive: '2026-02-05T11:30:00.000Z',
      createdAt: '2026-01-20T09:00:00.000Z',
    },
    {
      id: 'agent-uuid-2',
      name: 'Engineering Bot',
      role: 'engineering',
      status: 'idle',
      modelTier: 'opus',
      thinkingMode: 'extended',
      temperature: 0.5,
      avatarColor: '#10b981',
      lastActive: '2026-02-04T16:00:00.000Z',
      createdAt: '2026-01-22T10:00:00.000Z',
    },
  ],
};

const mockDetailResponse = {
  id: AGENT_ID,
  name: 'PM Bot',
  role: 'pm',
  status: 'active',
  modelTier: 'sonnet',
  thinkingMode: 'standard',
  temperature: 0.3,
  avatarColor: '#6366f1',
  toolPolicy: { allow: ['web_search'] },
  metrics: { messagesLast24h: 25, toolInvocationsLast24h: 10, avgResponseTime: 1500 },
  skills: [{ id: 'skill-1', name: 'Web Search', version: '1.0.0' }],
  lastActive: '2026-02-05T11:30:00.000Z',
  createdAt: '2026-01-20T09:00:00.000Z',
  updatedAt: '2026-02-05T12:00:00.000Z',
};

const mockUpdateResponse = {
  id: AGENT_ID,
  name: 'Updated Bot',
  modelTier: 'opus',
  thinkingMode: 'extended',
  updatedAt: '2026-02-05T14:00:00.000Z',
};

const mockRestartResponse = {
  message: 'Agent restart initiated',
  agentId: AGENT_ID,
};

const mockPauseResponse = {
  id: AGENT_ID,
  status: 'paused',
  pausedAt: '2026-02-05T14:00:00.000Z',
};

const mockResumeResponse = {
  id: AGENT_ID,
  status: 'active',
  resumedAt: '2026-02-05T14:30:00.000Z',
};

// ---------------------------------------------------------------------------
// Test Suite: AgentsController
// ---------------------------------------------------------------------------
describe('AgentsController', () => {
  let controller: AgentsController;
  let agentsService: {
    listAgents: jest.Mock;
    createAgent: jest.Mock;
    getAgentDetail: jest.Mock;
    updateAgent: jest.Mock;
    deleteAgent: jest.Mock;
    restartAgent: jest.Mock;
    pauseAgent: jest.Mock;
    resumeAgent: jest.Mock;
  };

  beforeEach(async () => {
    agentsService = {
      listAgents: jest.fn(),
      createAgent: jest.fn(),
      getAgentDetail: jest.fn(),
      updateAgent: jest.fn(),
      deleteAgent: jest.fn(),
      restartAgent: jest.fn(),
      pauseAgent: jest.fn(),
      resumeAgent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [{ provide: AgentsService, useValue: agentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AgentsController>(AgentsController);
  });

  // =========================================================================
  // POST /api/dashboard/agents - Create Agent
  // =========================================================================
  describe('POST /dashboard/agents', () => {
    it('should create agent and return result', async () => {
      agentsService.createAgent.mockResolvedValue(mockCreateResponse);

      const dto = {
        name: 'New Agent',
        role: 'pm',
        modelTier: 'sonnet' as const,
        thinkingMode: 'standard' as const,
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: ['web_search'] },
      };

      const result = await controller.createAgent(mockRequest, dto);

      expect(result).toEqual(mockCreateResponse);
      expect(result.status).toBe('provisioning');
      expect(agentsService.createAgent).toHaveBeenCalledWith(TENANT_ID, dto);
    });

    it('should propagate BadRequestException when plan limit reached', async () => {
      agentsService.createAgent.mockRejectedValue(
        new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Agent limit reached for current plan',
          details: { currentCount: 3, planLimit: 3, planName: 'starter' },
        }),
      );

      const dto = {
        name: 'New Agent',
        role: 'pm',
        modelTier: 'sonnet' as const,
        thinkingMode: 'standard' as const,
        temperature: 0.3,
        avatarColor: '#6366f1',
        toolPolicy: { allow: [] },
      };

      await expect(controller.createAgent(mockRequest, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass optional fields to service when provided', async () => {
      agentsService.createAgent.mockResolvedValue(mockCreateResponse);

      const dto = {
        name: 'New Agent',
        role: 'pm',
        description: 'Manages project tasks',
        modelTier: 'sonnet' as const,
        thinkingMode: 'standard' as const,
        toolPolicy: { allow: ['web_search'] },
        temperature: 0.5,
        avatarColor: '#ff0000',
        personality: 'Friendly',
      };

      await controller.createAgent(mockRequest, dto);

      expect(agentsService.createAgent).toHaveBeenCalledWith(TENANT_ID, dto);
    });
  });

  // =========================================================================
  // GET /api/dashboard/agents - List Agents
  // =========================================================================
  describe('GET /dashboard/agents', () => {
    it('should return agents for tenant', async () => {
      agentsService.listAgents.mockResolvedValue(mockListResponse);

      const result = await controller.listAgents(mockRequest, {});

      expect(result).toEqual(mockListResponse);
      expect(result.data).toHaveLength(2);
      expect(agentsService.listAgents).toHaveBeenCalledWith(TENANT_ID, {});
    });

    it('should pass filter query params to service', async () => {
      agentsService.listAgents.mockResolvedValue(mockListResponse);
      const query = { status: 'active' as const, role: 'pm' };

      await controller.listAgents(mockRequest, query);

      expect(agentsService.listAgents).toHaveBeenCalledWith(TENANT_ID, query);
    });

    it('should pass sort query params to service', async () => {
      agentsService.listAgents.mockResolvedValue(mockListResponse);
      const query = { sort: 'name:asc' as const };

      await controller.listAgents(mockRequest, query);

      expect(agentsService.listAgents).toHaveBeenCalledWith(TENANT_ID, query);
    });
  });

  // =========================================================================
  // GET /api/dashboard/agents/:id - Get Agent Detail
  // =========================================================================
  describe('GET /dashboard/agents/:id', () => {
    it('should return full agent data', async () => {
      agentsService.getAgentDetail.mockResolvedValue(mockDetailResponse);

      const result = await controller.getAgentDetail(mockRequest, AGENT_ID);

      expect(result).toEqual(mockDetailResponse);
      expect(result.metrics).toBeDefined();
      expect(result.skills).toBeDefined();
      expect(result.toolPolicy).toBeDefined();
      expect(agentsService.getAgentDetail).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
      );
    });

    it('should propagate NotFoundException for missing agent', async () => {
      agentsService.getAgentDetail.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );

      await expect(
        controller.getAgentDetail(mockRequest, 'nonexistent-agent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call service with correct tenant id and agent id', async () => {
      agentsService.getAgentDetail.mockResolvedValue(mockDetailResponse);

      await controller.getAgentDetail(mockRequest, AGENT_ID);

      expect(agentsService.getAgentDetail).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
      );
    });
  });

  // =========================================================================
  // PATCH /api/dashboard/agents/:id - Update Agent
  // =========================================================================
  describe('PATCH /dashboard/agents/:id', () => {
    it('should update and return result', async () => {
      agentsService.updateAgent.mockResolvedValue(mockUpdateResponse);

      const dto = { name: 'Updated Bot', modelTier: 'opus' as const };
      const result = await controller.updateAgent(mockRequest, AGENT_ID, dto);

      expect(result).toEqual(mockUpdateResponse);
      expect(agentsService.updateAgent).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
        dto,
      );
    });

    it('should propagate NotFoundException', async () => {
      agentsService.updateAgent.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );

      await expect(
        controller.updateAgent(mockRequest, 'nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow partial update (single field)', async () => {
      agentsService.updateAgent.mockResolvedValue(mockUpdateResponse);

      const dto = { thinkingMode: 'extended' as const };
      await controller.updateAgent(mockRequest, AGENT_ID, dto);

      expect(agentsService.updateAgent).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
        dto,
      );
    });
  });

  // =========================================================================
  // DELETE /api/dashboard/agents/:id - Delete Agent
  // =========================================================================
  describe('DELETE /dashboard/agents/:id', () => {
    it('should delete agent and return void', async () => {
      agentsService.deleteAgent.mockResolvedValue(undefined);

      const result = await controller.deleteAgent(mockRequest, AGENT_ID);

      expect(result).toBeUndefined();
      expect(agentsService.deleteAgent).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
      );
    });

    it('should propagate NotFoundException', async () => {
      agentsService.deleteAgent.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );

      await expect(
        controller.deleteAgent(mockRequest, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // POST /api/dashboard/agents/:id/actions/restart - Restart Agent
  // =========================================================================
  describe('POST /dashboard/agents/:id/actions/restart', () => {
    it('should restart agent and return result', async () => {
      agentsService.restartAgent.mockResolvedValue(mockRestartResponse);

      const result = await controller.restartAgent(mockRequest, AGENT_ID);

      expect(result).toEqual(mockRestartResponse);
      expect(result.message).toBe('Agent restart initiated');
      expect(result.agentId).toBe(AGENT_ID);
      expect(agentsService.restartAgent).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
      );
    });

    it('should propagate NotFoundException', async () => {
      agentsService.restartAgent.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );

      await expect(
        controller.restartAgent(mockRequest, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // POST /api/dashboard/agents/:id/actions/pause - Pause Agent
  // =========================================================================
  describe('POST /dashboard/agents/:id/actions/pause', () => {
    it('should pause agent and return result', async () => {
      agentsService.pauseAgent.mockResolvedValue(mockPauseResponse);

      const result = await controller.pauseAgent(mockRequest, AGENT_ID);

      expect(result).toEqual(mockPauseResponse);
      expect(result.status).toBe('paused');
      expect(result.pausedAt).toBeDefined();
      expect(agentsService.pauseAgent).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
      );
    });

    it('should propagate BadRequestException when already paused', async () => {
      agentsService.pauseAgent.mockRejectedValue(
        new BadRequestException('Agent is already paused'),
      );

      await expect(
        controller.pauseAgent(mockRequest, AGENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException', async () => {
      agentsService.pauseAgent.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );

      await expect(
        controller.pauseAgent(mockRequest, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // POST /api/dashboard/agents/:id/actions/resume - Resume Agent
  // =========================================================================
  describe('POST /dashboard/agents/:id/actions/resume', () => {
    it('should resume agent and return result', async () => {
      agentsService.resumeAgent.mockResolvedValue(mockResumeResponse);

      const result = await controller.resumeAgent(mockRequest, AGENT_ID);

      expect(result).toEqual(mockResumeResponse);
      expect(result.status).toBe('active');
      expect(result.resumedAt).toBeDefined();
      expect(agentsService.resumeAgent).toHaveBeenCalledWith(
        TENANT_ID,
        AGENT_ID,
      );
    });

    it('should propagate BadRequestException when not paused', async () => {
      agentsService.resumeAgent.mockRejectedValue(
        new BadRequestException('Agent is not paused'),
      );

      await expect(
        controller.resumeAgent(mockRequest, AGENT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should propagate NotFoundException', async () => {
      agentsService.resumeAgent.mockRejectedValue(
        new NotFoundException('Agent not found'),
      );

      await expect(
        controller.resumeAgent(mockRequest, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // HTTP Status Code Configuration
  // =========================================================================
  describe('HTTP Status Code Configuration', () => {
    it('should configure 200 OK for GET /dashboard/agents (listAgents)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.listAgents,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 201 CREATED for POST /dashboard/agents (createAgent)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.createAgent,
      );
      expect(statusCode).toBe(HttpStatus.CREATED);
    });

    it('should configure 200 OK for GET /dashboard/agents/:id (getAgentDetail)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.getAgentDetail,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for PATCH /dashboard/agents/:id (updateAgent)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.updateAgent,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 204 NO_CONTENT for DELETE /dashboard/agents/:id (deleteAgent)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.deleteAgent,
      );
      expect(statusCode).toBe(HttpStatus.NO_CONTENT);
    });

    it('should configure 202 ACCEPTED for POST /dashboard/agents/:id/actions/restart (restartAgent)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.restartAgent,
      );
      expect(statusCode).toBe(HttpStatus.ACCEPTED);
    });

    it('should configure 200 OK for POST /dashboard/agents/:id/actions/pause (pauseAgent)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.pauseAgent,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });

    it('should configure 200 OK for POST /dashboard/agents/:id/actions/resume (resumeAgent)', () => {
      const statusCode = Reflect.getMetadata(
        '__httpCode__',
        AgentsController.prototype.resumeAgent,
      );
      expect(statusCode).toBe(HttpStatus.OK);
    });
  });

  // =========================================================================
  // Guard Configuration
  // =========================================================================
  describe('Guard Configuration', () => {
    it('should have JwtAuthGuard and TenantGuard applied to the controller', () => {
      const guards = Reflect.getMetadata('__guards__', AgentsController);
      expect(guards).toBeDefined();
      expect(guards.length).toBe(2);
      // Verify guard types (JwtAuthGuard and TenantGuard)
      const guardNames = guards.map((g: any) => g.name || g.constructor?.name);
      expect(guardNames).toContain('JwtAuthGuard');
      expect(guardNames).toContain('TenantGuard');
    });
  });
});
