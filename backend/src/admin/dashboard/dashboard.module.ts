import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { SecurityPostureController } from './security-posture.controller';
import { SecurityPostureService } from './security-posture.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController, SecurityPostureController],
  providers: [DashboardService, SecurityPostureService],
})
export class DashboardModule {}
