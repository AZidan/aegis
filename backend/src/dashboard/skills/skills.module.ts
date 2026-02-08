import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

/**
 * Skills Module - Tenant: Skills
 *
 * Provides skill marketplace browsing, installation, and management
 * within a tenant context.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
