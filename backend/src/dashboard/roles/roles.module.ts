import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * Roles Module - Agent Role Configuration
 *
 * Provides the GET /api/dashboard/roles endpoint for listing
 * available agent role configurations.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
