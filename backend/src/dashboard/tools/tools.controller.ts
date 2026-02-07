import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ToolsService } from './tools.service';

/**
 * Tools Controller - Tool Policy Configuration
 *
 * Provides endpoints for tool category metadata and role-based
 * default policies. Used by the agent creation wizard (Step 3)
 * to present available tool categories and suggest defaults.
 *
 * All endpoints require JWT authentication and a valid tenant context.
 *
 * Endpoints:
 * 1. GET /api/dashboard/tools/categories       - List all tool categories
 * 2. GET /api/dashboard/tools/defaults/:role    - Get default policy for a role
 */
@Controller('dashboard/tools')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  // ==========================================================================
  // GET /api/dashboard/tools/categories - List Tool Categories
  // Response: { data: ToolCategory[] }
  // ==========================================================================
  @Get('categories')
  @HttpCode(HttpStatus.OK)
  listCategories() {
    return this.toolsService.listCategories();
  }

  // ==========================================================================
  // GET /api/dashboard/tools/defaults/:role - Get Role Default Policy
  // Response: { role: string, policy: { allow: string[], deny: string[] } }
  // ==========================================================================
  @Get('defaults/:role')
  @HttpCode(HttpStatus.OK)
  getDefaultsForRole(@Param('role') role: string) {
    return this.toolsService.getDefaultsForRole(role);
  }
}
