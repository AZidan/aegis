import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { ChannelsModule } from '../../channels/channels.module';
import { ProvisioningModule } from '../../provisioning/provisioning.module';

/**
 * Agents Module - Tenant: Agents
 *
 * Provides CRUD operations for agents within a tenant context.
 * Imports ChannelsModule for channel routing integration.
 * Imports ProvisioningModule for container config sync on agent create/update.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  imports: [ChannelsModule, ProvisioningModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
