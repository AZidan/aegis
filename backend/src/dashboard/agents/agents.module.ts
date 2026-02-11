import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { ContainerModule } from '../../container/container.module';

/**
 * Agents Module - Tenant: Agents
 *
 * Provides CRUD operations for agents within a tenant context.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  imports: [ContainerModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
