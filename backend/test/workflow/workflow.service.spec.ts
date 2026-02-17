import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowService } from '../../src/workflow/workflow.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { WORKFLOW_QUEUE_NAME } from '../../src/workflow/workflow.constants';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const NOW = new Date('2026-02-15T12:00:00.000Z');

const MOCK_TEMPLATE = {
  id: 'tpl-1',
  name: 'daily_sync',
  label: 'Daily Sync',
  description: 'Test template',
  isSystem: true,
  tenantId: null,
  steps: [{ name: 'step1', type: 'data_request', timeoutMs: 300000 }],
  createdAt: NOW,
  updatedAt: NOW,
};

const MOCK_TENANT_TEMPLATE = {
  ...MOCK_TEMPLATE,
  id: 'tpl-2',
  name: 'custom_workflow',
  label: 'Custom',
  isSystem: false,
  tenantId: 'tenant-1',
};

const MOCK_INSTANCE = {
  id: 'inst-1',
  templateId: 'tpl-1',
  tenantId: 'tenant-1',
  status: 'pending',
  currentStep: 0,
  triggeredBy: 'user-1',
  inputData: { agentIds: ['agent-1', 'agent-2'] },
  stepLogs: [],
  completedAt: null,
  failedAt: null,
  failureReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  template: { name: 'daily_sync', label: 'Daily Sync', steps: MOCK_TEMPLATE.steps },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  workflowTemplate: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  workflowInstance: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  agent: {
    findMany: jest.fn(),
  },
};

const mockQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowService', () => {
  let service: WorkflowService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken(WORKFLOW_QUEUE_NAME), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(WorkflowService);
  });

  // ---- getTemplates ----

  it('should list built-in + tenant templates', async () => {
    mockPrisma.workflowTemplate.findMany.mockResolvedValue([
      MOCK_TEMPLATE,
      MOCK_TENANT_TEMPLATE,
    ]);

    const result = await service.getTemplates('tenant-1');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('daily_sync');
    expect(result[1].name).toBe('custom_workflow');
    expect(mockPrisma.workflowTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ tenantId: null }, { tenantId: 'tenant-1' }] },
      }),
    );
  });

  it('should filter out other tenant templates', async () => {
    mockPrisma.workflowTemplate.findMany.mockResolvedValue([MOCK_TEMPLATE]);

    const result = await service.getTemplates('tenant-2');
    expect(result).toHaveLength(1);
    expect(result[0].isSystem).toBe(true);
  });

  // ---- triggerWorkflow ----

  it('should throw NotFoundException when template not found', async () => {
    mockPrisma.workflowTemplate.findFirst.mockResolvedValue(null);

    await expect(
      service.triggerWorkflow('tpl-999', { agentIds: ['a1'] }, 'tenant-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException when agentIds do not belong to tenant', async () => {
    mockPrisma.workflowTemplate.findFirst.mockResolvedValue(MOCK_TEMPLATE);
    mockPrisma.agent.findMany.mockResolvedValue([{ id: 'agent-1' }]);

    await expect(
      service.triggerWorkflow(
        'tpl-1',
        { agentIds: ['agent-1', 'agent-2'] },
        'tenant-1',
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create instance and enqueue first step on trigger', async () => {
    mockPrisma.workflowTemplate.findFirst.mockResolvedValue(MOCK_TEMPLATE);
    mockPrisma.agent.findMany.mockResolvedValue([
      { id: 'agent-1' },
      { id: 'agent-2' },
    ]);
    mockPrisma.workflowInstance.create.mockResolvedValue({
      ...MOCK_INSTANCE,
      id: 'new-inst',
    });

    const result = await service.triggerWorkflow(
      'tpl-1',
      { agentIds: ['agent-1', 'agent-2'] },
      'tenant-1',
      'user-1',
    );

    expect(result.id).toBe('new-inst');
    expect(result.status).toBe('pending');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'execute-step',
      { instanceId: 'new-inst', stepIndex: 0 },
      expect.any(Object),
    );
  });

  // ---- getInstances ----

  it('should return paginated instances with cursor', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      ...MOCK_INSTANCE,
      id: `inst-${i}`,
    }));
    mockPrisma.workflowInstance.findMany.mockResolvedValue(items);

    const result = await service.getInstances('tenant-1', { limit: 20 });
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  it('should filter instances by status', async () => {
    mockPrisma.workflowInstance.findMany.mockResolvedValue([]);

    await service.getInstances('tenant-1', { status: 'completed' as any, limit: 20 });

    expect(mockPrisma.workflowInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  // ---- getInstanceById ----

  it('should return instance detail', async () => {
    mockPrisma.workflowInstance.findFirst.mockResolvedValue(MOCK_INSTANCE);

    const result = await service.getInstanceById('inst-1', 'tenant-1');
    expect(result.id).toBe('inst-1');
    expect(result.templateName).toBe('daily_sync');
  });

  it('should throw NotFoundException when instance not found', async () => {
    mockPrisma.workflowInstance.findFirst.mockResolvedValue(null);

    await expect(
      service.getInstanceById('inst-999', 'tenant-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
