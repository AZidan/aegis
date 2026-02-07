import { Injectable, NotFoundException } from '@nestjs/common';
import { TOOL_CATEGORIES, ToolCategory } from './tool-categories';
import { ROLE_DEFAULT_POLICIES } from './role-defaults';

/**
 * Tools Service - Tool Policy Configuration
 *
 * Provides tool category metadata and role-based default policies.
 * These are static configurations that do not require database access.
 *
 * Endpoints:
 * - GET /api/dashboard/tools/categories  -> listCategories()
 * - GET /api/dashboard/tools/defaults/:role -> getDefaultsForRole()
 */
@Injectable()
export class ToolsService {
  /**
   * List all available tool categories.
   *
   * Response format:
   * { data: ToolCategory[] }
   */
  listCategories(): { data: ToolCategory[] } {
    return { data: TOOL_CATEGORIES };
  }

  /**
   * Get the default tool policy for a given agent role.
   *
   * Validates that the role exists in ROLE_DEFAULT_POLICIES.
   * Throws 404 if the role is not recognized.
   *
   * Response format:
   * { role: string, policy: { allow: string[], deny: string[] } }
   */
  getDefaultsForRole(role: string): {
    role: string;
    policy: { allow: string[]; deny: string[] };
  } {
    const policy = ROLE_DEFAULT_POLICIES[role];

    if (!policy) {
      const validRoles = Object.keys(ROLE_DEFAULT_POLICIES).join(', ');
      throw new NotFoundException(
        `Unknown role "${role}". Valid roles: ${validRoles}`,
      );
    }

    return { role, policy };
  }
}
