import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ToolsService } from '../../../src/dashboard/tools/tools.service';
import { TOOL_CATEGORIES } from '../../../src/dashboard/tools/tool-categories';
import { ROLE_DEFAULT_POLICIES } from '../../../src/dashboard/tools/role-defaults';

// ---------------------------------------------------------------------------
// Test Suite: ToolsService
// ---------------------------------------------------------------------------
describe('ToolsService', () => {
  let service: ToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolsService],
    }).compile();

    service = module.get<ToolsService>(ToolsService);
  });

  // =========================================================================
  // listCategories
  // =========================================================================
  describe('listCategories', () => {
    it('should return all 8 tool categories', () => {
      const result = service.listCategories();

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(8);
    });

    it('should wrap categories in a data envelope', () => {
      const result = service.listCategories();

      expect(result).toEqual({ data: expect.any(Array) });
    });

    it('should include required fields on every category', () => {
      const result = service.listCategories();

      for (const category of result.data) {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('tools');
        expect(category).toHaveProperty('riskLevel');
      }
    });

    it('should have string id, name, and description on every category', () => {
      const result = service.listCategories();

      for (const category of result.data) {
        expect(typeof category.id).toBe('string');
        expect(typeof category.name).toBe('string');
        expect(typeof category.description).toBe('string');
      }
    });

    it('should have a non-empty tools array on every category', () => {
      const result = service.listCategories();

      for (const category of result.data) {
        expect(Array.isArray(category.tools)).toBe(true);
        expect(category.tools.length).toBeGreaterThan(0);
      }
    });

    it('should have only valid risk levels on every category', () => {
      const validRiskLevels = ['low', 'medium', 'high'];
      const result = service.listCategories();

      for (const category of result.data) {
        expect(validRiskLevels).toContain(category.riskLevel);
      }
    });

    it('should contain the expected category IDs', () => {
      const result = service.listCategories();
      const ids = result.data.map((c) => c.id);

      expect(ids).toContain('analytics');
      expect(ids).toContain('project_management');
      expect(ids).toContain('code_management');
      expect(ids).toContain('devops');
      expect(ids).toContain('communication');
      expect(ids).toContain('monitoring');
      expect(ids).toContain('data_access');
      expect(ids).toContain('web_search');
    });

    it('should return the same reference as TOOL_CATEGORIES', () => {
      const result = service.listCategories();

      expect(result.data).toBe(TOOL_CATEGORIES);
    });
  });

  // =========================================================================
  // getDefaultsForRole
  // =========================================================================
  describe('getDefaultsForRole', () => {
    it('should return PM defaults with correct policy', () => {
      const result = service.getDefaultsForRole('pm');

      expect(result).toEqual({
        role: 'pm',
        policy: ROLE_DEFAULT_POLICIES['pm'],
      });
    });

    it('should return engineering defaults with correct policy', () => {
      const result = service.getDefaultsForRole('engineering');

      expect(result).toEqual({
        role: 'engineering',
        policy: ROLE_DEFAULT_POLICIES['engineering'],
      });
    });

    it('should return operations defaults with correct policy', () => {
      const result = service.getDefaultsForRole('operations');

      expect(result).toEqual({
        role: 'operations',
        policy: ROLE_DEFAULT_POLICIES['operations'],
      });
    });

    it('should return custom defaults with correct policy', () => {
      const result = service.getDefaultsForRole('custom');

      expect(result).toEqual({
        role: 'custom',
        policy: ROLE_DEFAULT_POLICIES['custom'],
      });
    });

    it('should include allow and deny arrays in every role policy', () => {
      const validRoles = ['pm', 'engineering', 'operations', 'custom'];

      for (const role of validRoles) {
        const result = service.getDefaultsForRole(role);

        expect(result.policy).toHaveProperty('allow');
        expect(result.policy).toHaveProperty('deny');
        expect(Array.isArray(result.policy.allow)).toBe(true);
        expect(Array.isArray(result.policy.deny)).toBe(true);
      }
    });

    it('should return the role name in the response', () => {
      const result = service.getDefaultsForRole('pm');

      expect(result.role).toBe('pm');
    });

    it('should throw NotFoundException for invalid role', () => {
      expect(() => service.getDefaultsForRole('invalid')).toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for empty role string', () => {
      expect(() => service.getDefaultsForRole('')).toThrow(NotFoundException);
    });

    it('should include valid roles in the NotFoundException message', () => {
      try {
        service.getDefaultsForRole('invalid');
        fail('Expected NotFoundException');
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        const message = (error as NotFoundException).message;
        expect(message).toContain('pm');
        expect(message).toContain('engineering');
        expect(message).toContain('operations');
        expect(message).toContain('custom');
      }
    });

    it('should have PM defaults deny devops and data_access', () => {
      const result = service.getDefaultsForRole('pm');

      expect(result.policy.deny).toContain('devops');
      expect(result.policy.deny).toContain('data_access');
    });

    it('should have engineering defaults with empty deny list', () => {
      const result = service.getDefaultsForRole('engineering');

      expect(result.policy.deny).toEqual([]);
    });

    it('should have operations defaults deny code_management and devops', () => {
      const result = service.getDefaultsForRole('operations');

      expect(result.policy.deny).toContain('code_management');
      expect(result.policy.deny).toContain('devops');
    });
  });
});
