import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';

/**
 * Dashboard Module - Parent module for all tenant-facing routes at /api/dashboard/*
 *
 * Imports all tenant dashboard sub-modules:
 * - AgentsModule: CRUD operations for agents
 *
 * Additional modules (skills, team, audit, settings) will be added in future sprints.
 */
@Module({
  imports: [AgentsModule],
})
export class DashboardModule {}
