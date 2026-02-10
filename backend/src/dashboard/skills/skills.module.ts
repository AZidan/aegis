import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { PermissionService } from './permission.service';
import { PrivateSkillsController } from './private-skills.controller';
import { PrivateSkillsService } from './private-skills.service';
import { NetworkPolicyController } from './network-policy.controller';
import { NetworkPolicyAdminController } from './network-policy-admin.controller';
import { NetworkPolicyService } from './network-policy.service';
import { SkillValidatorService } from './skill-validator.service';
import { ALERT_QUEUE_NAME } from '../../alert/alert.constants';

/**
 * Skills Module - Tenant: Skills
 *
 * Provides skill marketplace browsing, installation, and management
 * within a tenant context. Also includes private skill registry
 * for tenant-scoped skill submission and management, and network policy
 * enforcement derived from installed skills' permission manifests.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  imports: [BullModule.registerQueue({ name: ALERT_QUEUE_NAME })],
  controllers: [
    PrivateSkillsController,
    NetworkPolicyController,
    NetworkPolicyAdminController,
    SkillsController,
  ],
  providers: [
    SkillsService,
    PermissionService,
    PrivateSkillsService,
    NetworkPolicyService,
    SkillValidatorService,
  ],
  exports: [SkillsService, PermissionService, NetworkPolicyService],
})
export class SkillsModule {}
