import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CONTAINER_BASE_PORT } from './container.constants';

@Injectable()
export class ContainerPortAllocatorService {
  private readonly logger = new Logger(ContainerPortAllocatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Deterministic allocation with bounded linear probing:
   * - seed port = basePort + hash(tenantId) % range
   * - probe next ports until a free one is found
   */
  async allocate(tenantId: string): Promise<number> {
    const basePort = this.configService.get<number>(
      'container.basePort',
      DEFAULT_CONTAINER_BASE_PORT,
    );
    const range = this.configService.get<number>('container.portRange', 1000);

    if (range <= 0) {
      throw new Error('container.portRange must be greater than 0');
    }

    const occupiedPorts = await this.getOccupiedPorts();
    const seedOffset = this.hashToOffset(tenantId, range);

    for (let i = 0; i < range; i++) {
      const candidate = basePort + ((seedOffset + i) % range);
      if (!occupiedPorts.has(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `No free container ports available in range [${basePort}, ${basePort + range - 1}]`,
    );
  }

  private async getOccupiedPorts(): Promise<Set<number>> {
    const tenants = await this.prisma.tenant.findMany({
      where: { containerUrl: { not: null } },
      select: { id: true, containerUrl: true },
    });

    const ports = new Set<number>();
    for (const tenant of tenants) {
      const port = this.extractPort(tenant.containerUrl);
      if (port !== null) {
        ports.add(port);
      }
    }

    this.logger.debug(`Found ${ports.size} occupied container ports`);
    return ports;
  }

  private extractPort(containerUrl: string | null): number | null {
    if (!containerUrl) {
      return null;
    }

    try {
      const parsed = new URL(containerUrl);
      if (!parsed.port) {
        return null;
      }
      const numericPort = Number(parsed.port);
      return Number.isInteger(numericPort) ? numericPort : null;
    } catch {
      return null;
    }
  }

  private hashToOffset(input: string, modulo: number): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash % modulo;
  }
}
