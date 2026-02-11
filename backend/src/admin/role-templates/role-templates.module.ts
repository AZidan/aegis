import { Module } from '@nestjs/common';
import { RoleTemplatesController } from './role-templates.controller';

/**
 * RoleTemplatesModule - Admin Role Config CRUD
 *
 * Provides platform-admin endpoints for managing AgentRoleConfig
 * entries including template fields (soulTemplate, agentsTemplate, etc.).
 *
 * PrismaService is globally available so no additional imports are needed.
 */
@Module({
  controllers: [RoleTemplatesController],
})
export class RoleTemplatesModule {}
