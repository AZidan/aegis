import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ProvisioningModule } from '../../provisioning/provisioning.module';

/**
 * Tenants Module - Platform Admin: Tenants
 *
 * Provides all 8 tenant management endpoints from API Contract v1.2.0 Section 3.
 * PrismaModule is @Global so it does not need to be imported here.
 * ProvisioningModule provides the ProvisioningService for async container provisioning.
 */
@Module({
  imports: [ProvisioningModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
