import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { WorkflowProcessor } from '../../src/workflow/workflow.processor';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MessagingService } from '../../src/messaging/messaging.service';
import { AllowlistService } from '../../src/messaging/allowlist.service';
import { WORKFLOW_QUEUE_NAME } from '../../src/workflow/workflow.constants';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TWO_STEP_TEMPLATE = {
  name: 'test_workflow',
  steps: [
    { name: 'step1', type: 'notification', timeoutMs: 60000 },
    { name: 'step2', type: 'data_request', timeoutMs: 300000 },
  ],
};

const ONE_STEP_TEMPLATE = {
  name: 'single_step',
  steps: [{ name: 'only_step', type: 'data_request', timeoutMs: 60000 }],
};

const makeMockInstance = (overrides: Record<string, any> = {}) => ({
  id: 'inst-1',
  templateId: 'tpl-1',
  tenantId: 'tenant-1',
  status: 'pending',
  currentStep: 0,
  triggeredBy: 'user-1',
  inputData: { agentIds: ['agent-1', 'agent-2', 'agent-3'] },
  stepLogs: [],
  template: TWO_STEP_TEMPLATE,
  ...overrides,
});

const mockJob = (name: string, data: any) => ({ name, data }) as any;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  workflowInstance: {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  },
};

const mockMessaging = {
  sendMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
};

const mockAllowlist = {
  canSendMessage: jest.fn().mockResolvedValue(true),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowProcessor', () => {
  let processor: WorkflowProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MessagingService, useValue: mockMessaging },
        { provide: AllowlistService, useValue: mockAllowlist },
        { provide: getQueueToken(WORKFLOW_QUEUE_NAME), useValue: mockQueue },
      ],
    }).compile();

    processor = module.get(WorkflowProcessor);
  });

  it('should execute step and send messages to recipients', async () => {
    mockPrisma.workflowInstance.findUnique.mockResolvedValue(makeMockInstance());

    await processor.process(mockJob('execute-step', { instanceId: 'inst-1', stepIndex: 0 }));

    // agent-1 is sender, agent-2 and agent-3 are recipients
    expect(mockMessaging.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({ recipientId: 'agent-2', type: 'notification' }),
      'tenant-1',
      'user-1',
    );
    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({ recipientId: 'agent-3', type: 'notification' }),
      'tenant-1',
      'user-1',
    );
  });

  it('should mark instance completed when last step finishes', async () => {
    mockPrisma.workflowInstance.findUnique.mockResolvedValue(
      makeMockInstance({ template: ONE_STEP_TEMPLATE, inputData: { agentIds: ['a1', 'a2'] } }),
    );

    await processor.process(mockJob('execute-step', { instanceId: 'inst-1', stepIndex: 0 }));

    expect(mockPrisma.workflowInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('should enqueue next step when not last step', async () => {
    mockPrisma.workflowInstance.findUnique.mockResolvedValue(makeMockInstance());

    await processor.process(mockJob('execute-step', { instanceId: 'inst-1', stepIndex: 0 }));

    expect(mockQueue.add).toHaveBeenCalledWith(
      'execute-step',
      { instanceId: 'inst-1', stepIndex: 1 },
      expect.any(Object),
    );
  });

  it('should handle timeout when instance still on same step', async () => {
    mockPrisma.workflowInstance.findUnique.mockResolvedValue(
      makeMockInstance({ status: 'running', currentStep: 0 }),
    );

    await processor.process(mockJob('timeout-step', { instanceId: 'inst-1', stepIndex: 0 }));

    expect(mockPrisma.workflowInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'timed_out' }),
      }),
    );
  });

  it('should skip timeout when instance already advanced', async () => {
    mockPrisma.workflowInstance.findUnique.mockResolvedValue(
      makeMockInstance({ status: 'running', currentStep: 1 }),
    );

    await processor.process(mockJob('timeout-step', { instanceId: 'inst-1', stepIndex: 0 }));

    // update should NOT be called since step already advanced
    expect(mockPrisma.workflowInstance.update).not.toHaveBeenCalled();
  });

  it('should mark instance failed on step error', async () => {
    mockPrisma.workflowInstance.findUnique.mockResolvedValue(
      makeMockInstance({ inputData: { agentIds: ['only-one'] } }), // Only 1 agent → error
    );

    await processor.process(mockJob('execute-step', { instanceId: 'inst-1', stepIndex: 0 }));

    expect(mockPrisma.workflowInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      }),
    );
  });

  it('should skip blocked recipients when allowlist check fails', async () => {
    mockAllowlist.canSendMessage
      .mockResolvedValueOnce(true) // agent-2: allowed
      .mockResolvedValueOnce(false); // agent-3: blocked

    mockPrisma.workflowInstance.findUnique.mockResolvedValue(makeMockInstance());

    await processor.process(mockJob('execute-step', { instanceId: 'inst-1', stepIndex: 0 }));

    // Only agent-2 should receive message (agent-3 blocked)
    expect(mockMessaging.sendMessage).toHaveBeenCalledTimes(1);
    expect(mockMessaging.sendMessage).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({ recipientId: 'agent-2' }),
      'tenant-1',
      'user-1',
    );
  });
});
