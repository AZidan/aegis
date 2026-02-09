import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { AllowlistService } from '../../src/messaging/allowlist.service';
import { AuditService } from '../../src/audit/audit.service';
import { PrismaService } from '../../src/prisma/prisma.service';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-05T12:00:00.000Z');

const MOCK_AGENT_1 = {
  id: 'agent-1',
  name: 'PM Agent',
  role: 'pm',
  status: 'active',
  tenantId: 'tenant-1',
};

const MOCK_AGENT_2 = {
  id: 'agent-2',
  name: 'Eng Agent',
  role: 'engineer',
  status: 'active',
  tenantId: 'tenant-1',
};

const MOCK_ALLOWLIST_ENTRY = {
  id: 'entry-1',
  agentId: 'agent-1',
  allowedAgentId: 'agent-2',
  direction: 'both',
  createdAt: NOW,
  updatedAt: NOW,
  allowedAgent: {
    id: 'agent-2',
    name: 'Eng Agent',
    role: 'engineer',
    status: 'active',
  },
};

// ---------------------------------------------------------------------------
// Test Suite: AllowlistService
// ---------------------------------------------------------------------------
describe('AllowlistService', () => {
  let service: AllowlistService;
  let mockAuditService: { logAction: jest.Mock };
  let mockCache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let prisma: {
    agent: { findFirst: jest.Mock; findMany: jest.Mock };
    agentAllowlist: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    mockAuditService = { logAction: jest.fn().mockResolvedValue(undefined) };
    mockCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      agent: { findFirst: jest.fn(), findMany: jest.fn() },
      agentAllowlist: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllowlistService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<AllowlistService>(AllowlistService);
  });

  // -----------------------------------------------------------------------
  // getAgentAllowlist
  // -----------------------------------------------------------------------
  describe('getAgentAllowlist', () => {
    it('should return allowlist entries for an agent', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT_1);
      prisma.agentAllowlist.findMany.mockResolvedValue([MOCK_ALLOWLIST_ENTRY]);

      const result = await service.getAgentAllowlist('agent-1', 'tenant-1');

      expect(result).toEqual({
        agentId: 'agent-1',
        agentName: 'PM Agent',
        entries: [
          {
            id: 'entry-1',
            allowedAgentId: 'agent-2',
            allowedAgentName: 'Eng Agent',
            allowedAgentRole: 'engineer',
            allowedAgentStatus: 'active',
            direction: 'both',
            createdAt: NOW.toISOString(),
          },
        ],
      });
      expect(prisma.agent.findFirst).toHaveBeenCalledWith({
        where: { id: 'agent-1', tenantId: 'tenant-1' },
      });
      expect(prisma.agentAllowlist.findMany).toHaveBeenCalledWith({
        where: { agentId: 'agent-1' },
        include: {
          allowedAgent: {
            select: { id: true, name: true, role: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException if agent not in tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(null);

      await expect(
        service.getAgentAllowlist('agent-999', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // updateAllowlist
  // -----------------------------------------------------------------------
  describe('updateAllowlist', () => {
    it('should delete existing and create new entries in a transaction', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT_1);
      prisma.agent.findMany.mockResolvedValue([{ id: 'agent-2' }]);
      prisma.agentAllowlist.findMany.mockResolvedValue([]); // no old entries

      const txDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      const txCreateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.$transaction.mockImplementation(async (cb) => {
        await cb({
          agentAllowlist: {
            deleteMany: txDeleteMany,
            createMany: txCreateMany,
          },
        });
      });

      const entries = [{ allowedAgentId: 'agent-2', direction: 'both' }];
      const result = await service.updateAllowlist(
        'agent-1',
        entries,
        'tenant-1',
        'user-1',
      );

      expect(result).toEqual({ agentId: 'agent-1', entryCount: 1 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txDeleteMany).toHaveBeenCalledWith({
        where: { agentId: 'agent-1' },
      });
      expect(txCreateMany).toHaveBeenCalledWith({
        data: [
          {
            agentId: 'agent-1',
            allowedAgentId: 'agent-2',
            direction: 'both',
          },
        ],
      });
    });

    it('should validate all target agents belong to same tenant', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT_1);
      prisma.agent.findMany.mockResolvedValue([
        { id: 'agent-2' },
        { id: 'agent-3' },
      ]);
      prisma.agentAllowlist.findMany.mockResolvedValue([]); // no old entries
      prisma.$transaction.mockImplementation(async (cb) => {
        await cb({
          agentAllowlist: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const entries = [
        { allowedAgentId: 'agent-2', direction: 'both' },
        { allowedAgentId: 'agent-3', direction: 'send_only' },
      ];
      await service.updateAllowlist('agent-1', entries, 'tenant-1', 'user-1');

      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['agent-2', 'agent-3'] }, tenantId: 'tenant-1' },
        select: { id: true },
      });
    });

    it('should throw NotFoundException for invalid target agents', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT_1);
      // Return only agent-2, so agent-999 is invalid
      prisma.agent.findMany.mockResolvedValue([{ id: 'agent-2' }]);

      const entries = [
        { allowedAgentId: 'agent-2', direction: 'both' },
        { allowedAgentId: 'agent-999', direction: 'send_only' },
      ];

      await expect(
        service.updateAllowlist('agent-1', entries, 'tenant-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateAllowlist('agent-1', entries, 'tenant-1', 'user-1'),
      ).rejects.toThrow('Agents not found in tenant: agent-999');
    });

    it('should call auditService.logAction with allowlist_updated', async () => {
      prisma.agent.findFirst.mockResolvedValue(MOCK_AGENT_1);
      prisma.agent.findMany.mockResolvedValue([{ id: 'agent-2' }]);
      prisma.agentAllowlist.findMany.mockResolvedValue([]); // no old entries
      prisma.$transaction.mockImplementation(async (cb) => {
        await cb({
          agentAllowlist: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      const entries = [{ allowedAgentId: 'agent-2', direction: 'both' }];
      await service.updateAllowlist('agent-1', entries, 'tenant-1', 'user-1');

      expect(mockAuditService.logAction).toHaveBeenCalledTimes(1);
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'user',
          actorId: 'user-1',
          action: 'allowlist_updated',
          targetType: 'agent',
          targetId: 'agent-1',
          tenantId: 'tenant-1',
          agentId: 'agent-1',
          userId: 'user-1',
          severity: 'info',
          details: expect.objectContaining({
            agentName: 'PM Agent',
            entryCount: 1,
            entries: [{ allowedAgentId: 'agent-2', direction: 'both' }],
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // canSendMessage
  // -----------------------------------------------------------------------
  describe('canSendMessage', () => {
    it('should return true when sender has both direction entry', async () => {
      mockCache.get.mockResolvedValue(undefined);
      prisma.agentAllowlist.findFirst.mockResolvedValueOnce({
        id: 'entry-1',
        agentId: 'agent-1',
        allowedAgentId: 'agent-2',
        direction: 'both',
      });

      const result = await service.canSendMessage('agent-1', 'agent-2');

      expect(result).toBe(true);
      expect(prisma.agentAllowlist.findFirst).toHaveBeenCalledWith({
        where: {
          agentId: 'agent-1',
          allowedAgentId: 'agent-2',
          direction: { in: ['both', 'send_only'] },
        },
      });
    });

    it('should return true when sender has send_only direction entry', async () => {
      mockCache.get.mockResolvedValue(undefined);
      prisma.agentAllowlist.findFirst.mockResolvedValueOnce({
        id: 'entry-2',
        agentId: 'agent-1',
        allowedAgentId: 'agent-2',
        direction: 'send_only',
      });

      const result = await service.canSendMessage('agent-1', 'agent-2');

      expect(result).toBe(true);
    });

    it('should return true when recipient has receive_only reverse entry', async () => {
      mockCache.get.mockResolvedValue(undefined);
      // First call (sender check) returns null
      prisma.agentAllowlist.findFirst.mockResolvedValueOnce(null);
      // Second call (recipient reverse check) returns match
      prisma.agentAllowlist.findFirst.mockResolvedValueOnce({
        id: 'entry-3',
        agentId: 'agent-2',
        allowedAgentId: 'agent-1',
        direction: 'receive_only',
      });

      const result = await service.canSendMessage('agent-1', 'agent-2');

      expect(result).toBe(true);
      expect(prisma.agentAllowlist.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.agentAllowlist.findFirst).toHaveBeenLastCalledWith({
        where: {
          agentId: 'agent-2',
          allowedAgentId: 'agent-1',
          direction: { in: ['both', 'receive_only'] },
        },
      });
    });

    it('should return false when no allowlist entry exists', async () => {
      mockCache.get.mockResolvedValue(undefined);
      prisma.agentAllowlist.findFirst.mockResolvedValue(null);

      const result = await service.canSendMessage('agent-1', 'agent-2');

      expect(result).toBe(false);
      expect(mockCache.set).toHaveBeenCalledWith(
        'allowlist:agent-1:agent-2',
        false,
        60000,
      );
    });

    it('should return cached value on cache hit', async () => {
      mockCache.get.mockResolvedValue(true);

      const result = await service.canSendMessage('agent-1', 'agent-2');

      expect(result).toBe(true);
      expect(prisma.agentAllowlist.findFirst).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith('allowlist:agent-1:agent-2');
    });

    it('should set cache on cache miss', async () => {
      mockCache.get.mockResolvedValue(undefined);
      prisma.agentAllowlist.findFirst.mockResolvedValueOnce({
        id: 'entry-1',
        agentId: 'agent-1',
        allowedAgentId: 'agent-2',
        direction: 'both',
      });

      await service.canSendMessage('agent-1', 'agent-2');

      expect(mockCache.set).toHaveBeenCalledWith(
        'allowlist:agent-1:agent-2',
        true,
        60000,
      );
    });
  });

  // -----------------------------------------------------------------------
  // getCommunicationGraph
  // -----------------------------------------------------------------------
  describe('getCommunicationGraph', () => {
    it('should return agents as nodes and allowlist as edges', async () => {
      prisma.agent.findMany.mockResolvedValue([
        { id: 'agent-1', name: 'PM Agent', role: 'pm', status: 'active' },
        {
          id: 'agent-2',
          name: 'Eng Agent',
          role: 'engineer',
          status: 'active',
        },
      ]);
      prisma.agentAllowlist.findMany.mockResolvedValue([
        {
          agentId: 'agent-1',
          allowedAgentId: 'agent-2',
          direction: 'both',
        },
      ]);

      const result = await service.getCommunicationGraph('tenant-1');

      expect(result).toEqual({
        nodes: [
          { id: 'agent-1', name: 'PM Agent', role: 'pm', status: 'active' },
          {
            id: 'agent-2',
            name: 'Eng Agent',
            role: 'engineer',
            status: 'active',
          },
        ],
        edges: [
          {
            source: 'agent-1',
            target: 'agent-2',
            direction: 'both',
          },
        ],
      });
      expect(prisma.agent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        select: { id: true, name: true, role: true, status: true },
      });
      expect(prisma.agentAllowlist.findMany).toHaveBeenCalledWith({
        where: { agentId: { in: ['agent-1', 'agent-2'] } },
        select: {
          agentId: true,
          allowedAgentId: true,
          direction: true,
        },
      });
    });

    it('should return empty graph when tenant has no agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);

      const result = await service.getCommunicationGraph('tenant-empty');

      expect(result).toEqual({
        nodes: [],
        edges: [],
      });
      expect(prisma.agentAllowlist.findMany).not.toHaveBeenCalled();
    });
  });
});
