import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { WORKFLOW_QUEUE_NAME } from './workflow.constants';
import { TriggerWorkflowDto } from './dto/trigger-workflow.dto';
import { QueryInstancesDto } from './dto/query-instances.dto';
import { WorkflowStep, ExecuteStepJob } from './interfaces/workflow.interface';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WORKFLOW_QUEUE_NAME) private readonly workflowQueue: Queue,
  ) {}

  /**
   * Get all workflow templates visible to a tenant.
   * Includes built-in (tenantId=null) + tenant-specific templates.
   */
  async getTemplates(tenantId: string) {
    const templates = await this.prisma.workflowTemplate.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId }],
      },
      orderBy: { createdAt: 'asc' },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      label: t.label,
      description: t.description,
      isSystem: t.isSystem,
      steps: t.steps as unknown as WorkflowStep[],
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /**
   * Trigger a workflow from a template.
   * Creates instance + enqueues first step.
   */
  async triggerWorkflow(
    templateId: string,
    dto: TriggerWorkflowDto,
    tenantId: string,
    userId: string,
  ) {
    // Verify template exists and is accessible to this tenant
    const template = await this.prisma.workflowTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ tenantId: null }, { tenantId }],
      },
    });

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    const steps = template.steps as unknown as WorkflowStep[];
    if (!steps || steps.length === 0) {
      throw new BadRequestException('Template has no steps defined');
    }

    // Verify all agentIds belong to the tenant
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: dto.agentIds }, tenantId },
      select: { id: true },
    });
    if (agents.length !== dto.agentIds.length) {
      throw new BadRequestException(
        'One or more agentIds do not belong to this tenant',
      );
    }

    // Create instance
    const instance = await this.prisma.workflowInstance.create({
      data: {
        templateId,
        tenantId,
        status: 'pending',
        currentStep: 0,
        triggeredBy: userId,
        inputData: { agentIds: dto.agentIds, ...dto.inputData },
        stepLogs: [],
      },
    });

    // Enqueue first step
    const job: ExecuteStepJob = {
      instanceId: instance.id,
      stepIndex: 0,
    };

    await this.workflowQueue.add('execute-step', job, {
      removeOnComplete: true,
      removeOnFail: 1000,
    });

    this.logger.log(
      `Workflow triggered: instance=${instance.id}, template=${template.name}`,
    );

    return {
      id: instance.id,
      templateId: instance.templateId,
      status: instance.status,
      currentStep: instance.currentStep,
      triggeredBy: instance.triggeredBy,
      createdAt: instance.createdAt.toISOString(),
    };
  }

  /**
   * List workflow instances for a tenant with cursor pagination.
   */
  async getInstances(tenantId: string, query: QueryInstancesDto) {
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.templateId) where.templateId = query.templateId;
    if (query.cursor) where.id = { lt: query.cursor };

    const instances = await this.prisma.workflowInstance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      include: {
        template: { select: { name: true, label: true } },
      },
    });

    const hasMore = instances.length > query.limit;
    const items = instances.slice(0, query.limit);

    return {
      items: items.map((i) => ({
        id: i.id,
        templateId: i.templateId,
        templateName: i.template.name,
        templateLabel: i.template.label,
        status: i.status,
        currentStep: i.currentStep,
        triggeredBy: i.triggeredBy,
        completedAt: i.completedAt?.toISOString() ?? null,
        failedAt: i.failedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    };
  }

  /**
   * Get a single workflow instance by ID (tenant-scoped).
   */
  async getInstanceById(instanceId: string, tenantId: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, tenantId },
      include: {
        template: { select: { name: true, label: true, steps: true } },
      },
    });

    if (!instance) {
      throw new NotFoundException('Workflow instance not found');
    }

    return {
      id: instance.id,
      templateId: instance.templateId,
      templateName: instance.template.name,
      templateLabel: instance.template.label,
      status: instance.status,
      currentStep: instance.currentStep,
      triggeredBy: instance.triggeredBy,
      inputData: instance.inputData,
      stepLogs: instance.stepLogs,
      steps: instance.template.steps,
      completedAt: instance.completedAt?.toISOString() ?? null,
      failedAt: instance.failedAt?.toISOString() ?? null,
      failureReason: instance.failureReason,
      createdAt: instance.createdAt.toISOString(),
      updatedAt: instance.updatedAt.toISOString(),
    };
  }
}
