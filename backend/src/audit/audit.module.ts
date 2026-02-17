import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditProcessor } from './audit.processor';
import { AuditRetentionService } from './audit-retention.service';
import { AuditRetentionProcessor } from './audit-retention.processor';
import { AuditInterceptor } from './audit.interceptor';
import { AuditController } from './audit.controller';
import { AuditAdminController } from './audit-admin.controller';
import { AUDIT_QUEUE_NAME, AUDIT_RETENTION_QUEUE_NAME } from './audit.constants';
import { ALERT_QUEUE_NAME } from '../alert/alert.constants';

/**
 * AuditModule
 *
 * Global module providing comprehensive audit logging infrastructure.
 *
 * Features:
 * - AuditService: fire-and-forget logAction() + cursor-paginated queryLogs() + exportLogs()
 * - AuditProcessor: BullMQ worker that writes audit events to DB asynchronously
 * - AuditRetentionService: nightly cron (2 AM) archiving logs > 90 days + enqueueing batch deletes
 * - AuditRetentionProcessor: BullMQ worker that disables immutability trigger, batch-deletes, re-enables
 * - AuditInterceptor: global interceptor capturing all POST/PUT/PATCH/DELETE requests
 * - AuditController: tenant dashboard audit endpoints (GET /api/dashboard/audit)
 * - AuditAdminController: platform admin audit endpoints (GET /api/admin/audit-logs)
 *
 * The module is marked @Global() so AuditService can be injected from any module
 * without explicit imports.
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - BullMQ (configured in AppModule.forRoot)
 * - ScheduleModule (configured in AppModule)
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: AUDIT_QUEUE_NAME }),
    BullModule.registerQueue({ name: ALERT_QUEUE_NAME }),
    BullModule.registerQueue({ name: AUDIT_RETENTION_QUEUE_NAME }),
  ],
  controllers: [AuditController, AuditAdminController],
  providers: [
    AuditService,
    AuditProcessor,
    AuditRetentionService,
    AuditRetentionProcessor,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
