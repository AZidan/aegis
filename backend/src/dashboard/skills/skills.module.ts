import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { PermissionService } from './permission.service';

/**
 * Skills Module - Tenant: Skills
 *
 * Provides skill marketplace browsing, installation, and management
 * within a tenant context.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  controllers: [SkillsController],
  providers: [SkillsService, PermissionService],
  exports: [SkillsService, PermissionService],
})
export class SkillsModule {}
