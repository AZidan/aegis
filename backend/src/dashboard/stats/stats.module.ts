import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

/**
 * Stats Module - Tenant: Dashboard Stats
 *
 * Provides the GET /api/dashboard/stats endpoint for aggregated
 * agent counts, activity metrics, and cost estimates.
 * PrismaService is globally available via PrismaModule.
 */
@Module({
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
