import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditProcessor } from './audit.processor';
import { AuditInterceptor } from './audit.interceptor';
import { AUDIT_QUEUE_NAME } from './audit.constants';

/**
 * AuditModule
 *
 * Global module providing comprehensive audit logging infrastructure.
 *
 * Features:
 * - AuditService: fire-and-forget logAction() + cursor-paginated queryLogs()
 * - AuditProcessor: BullMQ worker that writes audit events to DB asynchronously
 * - AuditInterceptor: global interceptor capturing all POST/PUT/PATCH/DELETE requests
 *
 * The module is marked @Global() so AuditService can be injected from any module
 * without explicit imports.
 *
 * Dependencies:
 * - PrismaModule (global, auto-imported)
 * - BullMQ (configured in AppModule.forRoot)
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: AUDIT_QUEUE_NAME })],
  providers: [
    AuditService,
    AuditProcessor,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
