import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowProcessor } from './workflow.processor';
import { MessagingModule } from '../messaging/messaging.module';
import { WORKFLOW_QUEUE_NAME } from './workflow.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: WORKFLOW_QUEUE_NAME }),
    MessagingModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowProcessor],
  exports: [WorkflowService],
})
export class WorkflowModule {}
