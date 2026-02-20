import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { PermissionService } from './permission.service';
import { SkillPackageController } from './skill-package.controller';
import { SkillPackageService } from './skill-package.service';
import { PrivateSkillsController } from './private-skills.controller';
import { PrivateSkillsService } from './private-skills.service';
import { NetworkPolicyController } from './network-policy.controller';
import { NetworkPolicyAdminController } from './network-policy-admin.controller';
import { NetworkPolicyService } from './network-policy.service';
import { SkillValidatorService } from './skill-validator.service';
import { ALERT_QUEUE_NAME } from '../../alert/alert.constants';
import { SkillReviewService } from './skill-review.service';
import { SkillReviewProcessor, SKILL_REVIEW_QUEUE } from './skill-review.processor';
import { SkillDeploymentService, SKILL_DEPLOYMENT_QUEUE } from './skill-deployment.service';
import { SkillDeploymentProcessor } from './skill-deployment.processor';
import { GitHubSkillImportModule } from '../../shared/github-skill-import';

/**
 * Skills Module - Tenant: Skills
 *
 * Provides skill marketplace browsing, installation, and management
 * within a tenant context. Also includes private skill registry
 * for tenant-scoped skill submission and management, network policy
 * enforcement, skill package upload/validation, and LLM-based review.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  imports: [
    GitHubSkillImportModule,
    BullModule.registerQueue(
      { name: ALERT_QUEUE_NAME },
      { name: SKILL_REVIEW_QUEUE },
      { name: SKILL_DEPLOYMENT_QUEUE },
    ),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  controllers: [
    SkillPackageController,
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
    SkillPackageService,
    SkillReviewService,
    SkillReviewProcessor,
    SkillDeploymentService,
    SkillDeploymentProcessor,
  ],
  exports: [SkillsService, PermissionService, NetworkPolicyService, SkillDeploymentService, SkillPackageService, SkillValidatorService],
})
export class SkillsModule {}
