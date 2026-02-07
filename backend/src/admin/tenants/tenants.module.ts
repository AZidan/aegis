import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

/**
 * Tenants Module - Platform Admin: Tenants
 *
 * Provides all 8 tenant management endpoints from API Contract v1.1.0 Section 3.
 * PrismaModule is @Global so it does not need to be imported here.
 */
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
