import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MulterModule } from '@nestjs/platform-express';
import { AdminSkillsReviewController } from './admin-skills-review.controller';
import { AdminSkillsReviewService } from './admin-skills-review.service';
import { GitHubSkillImportModule } from '../../shared/github-skill-import';
import { SkillsModule } from '../../dashboard/skills/skills.module';
import { SKILL_REVIEW_QUEUE } from '../../dashboard/skills/skill-review.processor';

@Module({
  imports: [
    SkillsModule,
    GitHubSkillImportModule,
    BullModule.registerQueue({ name: SKILL_REVIEW_QUEUE }),
    MulterModule.register({ limits: { fileSize: 5 * 1024 * 1024 } }),
  ],
  controllers: [AdminSkillsReviewController],
  providers: [AdminSkillsReviewService],
})
export class AdminSkillsReviewModule {}
