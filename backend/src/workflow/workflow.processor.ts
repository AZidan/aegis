import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { AllowlistService } from '../messaging/allowlist.service';
import { WORKFLOW_QUEUE_NAME, DEFAULT_STEP_TIMEOUT_MS } from './workflow.constants';
import {
  WorkflowStep,
  StepLog,
  ExecuteStepJob,
  TimeoutStepJob,
} from './interfaces/workflow.interface';

@Processor(WORKFLOW_QUEUE_NAME)
export class WorkflowProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagingService: MessagingService,
    private readonly allowlistService: AllowlistService,
    @InjectQueue(WORKFLOW_QUEUE_NAME) private readonly workflowQueue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'execute-step':
        return this.executeStep(job.data as ExecuteStepJob);
      case 'timeout-step':
        return this.timeoutStep(job.data as TimeoutStepJob);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async executeStep(data: ExecuteStepJob) {
    const { instanceId, stepIndex } = data;

    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { template: true },
    });

    if (!instance) {
      this.logger.warn(`Workflow instance not found: ${instanceId}`);
      return;
    }

    // Skip if instance is no longer in a runnable state
    if (instance.status !== 'pending' && instance.status !== 'running') {
      this.logger.log(
        `Skipping step ${stepIndex} — instance ${instanceId} is ${instance.status}`,
      );
      return;
    }

    const steps = instance.template.steps as unknown as WorkflowStep[];
    const step = steps[stepIndex];

    if (!step) {
      this.logger.warn(
        `Step ${stepIndex} not found in template ${instance.template.name}`,
      );
      return;
    }

    const stepLogs = (instance.stepLogs as unknown as StepLog[]) || [];
    const now = new Date().toISOString();

    // Mark instance as running and update step log
    const stepLog: StepLog = {
      step: stepIndex,
      name: step.name,
      status: 'running',
      startedAt: now,
    };
    stepLogs[stepIndex] = stepLog;

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: 'running',
        currentStep: stepIndex,
        stepLogs: stepLogs as any,
      },
    });

    try {
      // Resolve agents from inputData
      const inputData = instance.inputData as Record<string, unknown> | null;
      const agentIds = (inputData?.agentIds as string[]) || [];

      if (agentIds.length < 2) {
        throw new Error(
          'At least 2 agents are required for workflow coordination',
        );
      }

      // Use first agent as sender, broadcast to remaining agents
      const senderId = agentIds[0];
      const recipientIds = agentIds.slice(1);

      for (const recipientId of recipientIds) {
        // Check allowlist before sending
        const allowed = await this.allowlistService.canSendMessage(
          senderId,
          recipientId,
        );
        if (!allowed) {
          this.logger.warn(
            `Allowlist blocked: ${senderId} → ${recipientId} in workflow ${instanceId}`,
          );
          continue; // Skip this recipient, don't fail the whole step
        }

        await this.messagingService.sendMessage(
          senderId,
          {
            recipientId,
            type: this.mapStepType(step.type),
            payload: {
              workflowInstanceId: instanceId,
              workflowStep: step.name,
              stepIndex,
              ...(step.config || {}),
            },
          },
          instance.tenantId,
          instance.triggeredBy,
        );
      }

      // Mark step as completed
      stepLogs[stepIndex] = {
        ...stepLog,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };

      const isLastStep = stepIndex >= steps.length - 1;

      await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          stepLogs: stepLogs as any,
          ...(isLastStep
            ? { status: 'completed', completedAt: new Date() }
            : { currentStep: stepIndex + 1 }),
        },
      });

      // Enqueue next step if not finished
      if (!isLastStep) {
        const nextJob: ExecuteStepJob = {
          instanceId,
          stepIndex: stepIndex + 1,
        };
        await this.workflowQueue.add('execute-step', nextJob, {
          removeOnComplete: true,
          removeOnFail: 1000,
          delay: 1000, // 1s delay between steps
        });
      }

      this.logger.log(
        `Step ${stepIndex}/${steps.length - 1} completed for workflow ${instanceId}${isLastStep ? ' (workflow complete)' : ''}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Step ${stepIndex} failed for workflow ${instanceId}: ${errorMessage}`,
      );

      stepLogs[stepIndex] = {
        ...stepLog,
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: errorMessage,
      };

      await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'failed',
          failedAt: new Date(),
          failureReason: errorMessage,
          stepLogs: stepLogs as any,
        },
      });
    }

    // Enqueue timeout check
    const timeoutMs = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
    const timeoutJob: TimeoutStepJob = { instanceId, stepIndex };
    await this.workflowQueue.add('timeout-step', timeoutJob, {
      removeOnComplete: true,
      delay: timeoutMs,
    });
  }

  private async timeoutStep(data: TimeoutStepJob) {
    const { instanceId, stepIndex } = data;

    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) return;

    // Only timeout if instance is still running and on the same step
    if (instance.status !== 'running' || instance.currentStep !== stepIndex) {
      return;
    }

    this.logger.warn(
      `Step ${stepIndex} timed out for workflow ${instanceId}`,
    );

    const stepLogs = (instance.stepLogs as unknown as StepLog[]) || [];
    if (stepLogs[stepIndex]) {
      stepLogs[stepIndex] = {
        ...stepLogs[stepIndex],
        status: 'timed_out',
        completedAt: new Date().toISOString(),
        error: 'Step execution timed out',
      };
    }

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status: 'timed_out',
        failedAt: new Date(),
        failureReason: `Step ${stepIndex} timed out`,
        stepLogs: stepLogs as any,
      },
    });
  }

  /** Map workflow step type to messaging message type */
  private mapStepType(
    stepType: WorkflowStep['type'],
  ): 'notification' | 'data_request' | 'status_update' | 'task_handoff' {
    return stepType;
  }
}
