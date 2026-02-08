import { Module } from '@nestjs/common';
import { AgentsModule } from './agents/agents.module';
import { ToolsModule } from './tools/tools.module';
import { StatsModule } from './stats/stats.module';
import { RolesModule } from './roles/roles.module';
import { SkillsModule } from './skills/skills.module';

/**
 * Dashboard Module - Parent module for all tenant-facing routes at /api/dashboard/*
 *
 * Imports all tenant dashboard sub-modules:
 * - AgentsModule: CRUD operations for agents
 * - ToolsModule: Tool category metadata and role-based default policies
 * - StatsModule: Aggregated dashboard stats (agents, activity, cost)
 * - RolesModule: Agent role configuration (dynamic from DB)
 * - SkillsModule: Skill marketplace, installation, and management
 *
 * Additional modules (team, audit, settings) will be added in future sprints.
 */
@Module({
  imports: [AgentsModule, ToolsModule, StatsModule, RolesModule, SkillsModule],
})
export class DashboardModule {}
