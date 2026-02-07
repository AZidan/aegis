import { Module } from '@nestjs/common';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenantsModule } from './tenants/tenants.module';

@Module({
  imports: [DashboardModule, TenantsModule],
})
export class AdminModule {}
