import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Dashboard service methods will be implemented in Stage 3
  // Placeholder for:
  // - getStats()
  // - getAlerts()
}
