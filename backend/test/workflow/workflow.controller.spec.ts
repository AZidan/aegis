import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowController } from '../../src/workflow/workflow.controller';
import { WorkflowService } from '../../src/workflow/workflow.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockWorkflowService = {
  getTemplates: jest.fn().mockResolvedValue([
    { id: 'tpl-1', name: 'daily_sync', label: 'Daily Sync', steps: [] },
  ]),
  triggerWorkflow: jest.fn().mockResolvedValue({
    id: 'inst-1',
    templateId: 'tpl-1',
    status: 'pending',
    currentStep: 0,
  }),
  getInstances: jest.fn().mockResolvedValue({
    items: [],
    nextCursor: null,
  }),
  getInstanceById: jest.fn().mockResolvedValue({
    id: 'inst-1',
    templateId: 'tpl-1',
    status: 'running',
  }),
};

const mockReq = {
  tenantId: 'tenant-1',
  user: { id: 'user-1' },
} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowController', () => {
  let controller: WorkflowController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkflowController],
      providers: [
        { provide: WorkflowService, useValue: mockWorkflowService },
      ],
    }).compile();

    controller = module.get(WorkflowController);
  });

  it('getTemplates should call service.getTemplates', async () => {
    const result = await controller.getTemplates(mockReq);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('daily_sync');
    expect(mockWorkflowService.getTemplates).toHaveBeenCalledWith('tenant-1');
  });

  it('triggerWorkflow should call service.triggerWorkflow', async () => {
    const dto = { agentIds: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'] };
    const result = await controller.triggerWorkflow('tpl-1', dto, mockReq);

    expect(result.status).toBe('pending');
    expect(mockWorkflowService.triggerWorkflow).toHaveBeenCalledWith(
      'tpl-1',
      dto,
      'tenant-1',
      'user-1',
    );
  });

  it('getInstances should call service.getInstances', async () => {
    const query = { limit: 20 } as any;
    const result = await controller.getInstances(query, mockReq);

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('nextCursor');
    expect(mockWorkflowService.getInstances).toHaveBeenCalledWith(
      'tenant-1',
      query,
    );
  });
});
