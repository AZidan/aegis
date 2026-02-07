import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { ToolsModule } from './tools/tools.module';

/**
 * Dashboard Module - Parent module for all tenant-facing routes at /api/dashboard/*
 *
 * Imports all tenant dashboard sub-modules:
 * - AgentsModule: CRUD operations for agents
 * - ToolsModule: Tool category metadata and role-based default policies
 *
 * Additional modules (skills, team, audit, settings) will be added in future sprints.
 */
@Module({
  imports: [AgentsModule, ToolsModule],
})
export class DashboardModule {}
