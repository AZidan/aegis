import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AlertService } from './alert.service';
import { AlertProcessor } from './alert.processor';
import { AlertRulesEngine } from './alert-rules.engine';
import { AlertController } from './alert.controller';
import { ALERT_QUEUE_NAME } from './alert.constants';

@Module({
  imports: [BullModule.registerQueue({ name: ALERT_QUEUE_NAME })],
  controllers: [AlertController],
  providers: [AlertService, AlertProcessor, AlertRulesEngine],
  exports: [AlertService],
})
export class AlertModule {}
