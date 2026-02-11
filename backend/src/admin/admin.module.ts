import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantsModule } from './tenants/tenants.module';
import { AdminSkillsReviewModule } from './skills/admin-skills-review.module';
import { RoleTemplatesModule } from './role-templates/role-templates.module';

@Module({
  imports: [
    DashboardModule,
    TenantsModule,
    AdminSkillsReviewModule,
    RoleTemplatesModule,
  ],
})
export class AdminModule {}
