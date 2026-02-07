import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';

/**
 * Tools Module - Tool Policy Configuration
 *
 * Provides tool category metadata and role-based default policies
 * for the agent creation wizard and tool policy management.
 *
 * Routes: /api/dashboard/tools/*
 */
@Module({
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
