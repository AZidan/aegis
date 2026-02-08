import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Roles Service - Agent Role Configuration
 * Implements GET /api/dashboard/roles from API Contract v1.3.0 Section 5.
 *
 * Queries the AgentRoleConfig table for available agent roles,
 * ordered by sortOrder.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/dashboard/roles
   *
   * Response shape:
   * {
   *   data: Array<{
   *     id, name, label, description, color,
   *     defaultToolCategories, sortOrder, isSystem
   *   }>
   * }
   */
  async listRoles() {
    const roles = await this.prisma.agentRoleConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return {
      data: roles.map((role) => ({
        id: role.id,
        name: role.name,
        label: role.label,
        description: role.description,
        color: role.color,
        defaultToolCategories: role.defaultToolCategories,
        sortOrder: role.sortOrder,
        isSystem: role.isSystem,
      })),
    };
  }
}
