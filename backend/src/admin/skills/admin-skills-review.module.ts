import { Module } from '@nestjs/common';
import { AdminSkillsReviewController } from './admin-skills-review.controller';
import { AdminSkillsReviewService } from './admin-skills-review.service';

@Module({
  controllers: [AdminSkillsReviewController],
  providers: [AdminSkillsReviewService],
})
export class AdminSkillsReviewModule {}
