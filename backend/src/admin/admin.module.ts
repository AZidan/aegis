import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantsModule } from './tenants/tenants.module';
import { AdminSkillsReviewModule } from './skills/admin-skills-review.module';

@Module({
  imports: [DashboardModule, TenantsModule, AdminSkillsReviewModule],
})
export class AdminModule {}
