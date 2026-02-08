import { browseSkillsQuerySchema } from '../../../src/dashboard/skills/dto/browse-skills-query.dto';

// ---------------------------------------------------------------------------
// Test Suite: BrowseSkillsQueryDto (Zod schema validation)
// ---------------------------------------------------------------------------
describe('browseSkillsQuerySchema', () => {
  // =========================================================================
  // Valid cases
  // =========================================================================
  describe('valid inputs', () => {
    it('should accept an empty object with defaults applied', () => {
      const result = browseSkillsQuerySchema.parse({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.category).toBeUndefined();
      expect(result.role).toBeUndefined();
      expect(result.search).toBeUndefined();
      expect(result.sort).toBeUndefined();
    });

    it('should accept all fields provided', () => {
      const input = {
        category: 'analytics',
        role: 'engineering',
        search: 'web search',
        page: 2,
        limit: 50,
        sort: 'name:asc',
      };

      const result = browseSkillsQuerySchema.parse(input);

      expect(result.category).toBe('analytics');
      expect(result.role).toBe('engineering');
      expect(result.search).toBe('web search');
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.sort).toBe('name:asc');
    });

    it.each([
      'productivity',
      'analytics',
      'engineering',
      'communication',
    ] as const)('should accept category "%s"', (category) => {
      const result = browseSkillsQuerySchema.parse({ category });
      expect(result.category).toBe(category);
    });

    it.each([
      'name:asc',
      'name:desc',
      'rating:desc',
      'install_count:desc',
      'created_at:desc',
    ] as const)('should accept sort "%s"', (sort) => {
      const result = browseSkillsQuerySchema.parse({ sort });
      expect(result.sort).toBe(sort);
    });

    it('should coerce string numbers for page', () => {
      const result = browseSkillsQuerySchema.parse({ page: '3' });
      expect(result.page).toBe(3);
    });

    it('should coerce string numbers for limit', () => {
      const result = browseSkillsQuerySchema.parse({ limit: '50' });
      expect(result.limit).toBe(50);
    });

    it('should accept page = 1 (minimum)', () => {
      const result = browseSkillsQuerySchema.parse({ page: 1 });
      expect(result.page).toBe(1);
    });

    it('should accept limit = 1 (minimum)', () => {
      const result = browseSkillsQuerySchema.parse({ limit: 1 });
      expect(result.limit).toBe(1);
    });

    it('should accept limit = 100 (maximum)', () => {
      const result = browseSkillsQuerySchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should accept arbitrary role strings', () => {
      const result = browseSkillsQuerySchema.parse({ role: 'custom_role' });
      expect(result.role).toBe('custom_role');
    });

    it('should accept arbitrary search strings', () => {
      const result = browseSkillsQuerySchema.parse({ search: 'some query' });
      expect(result.search).toBe('some query');
    });
  });

  // =========================================================================
  // Invalid cases
  // =========================================================================
  describe('invalid inputs', () => {
    it('should reject invalid category value', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ category: 'unknown_category' }),
      ).toThrow();
    });

    it('should reject invalid sort value', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ sort: 'invalid_sort' }),
      ).toThrow();
    });

    it('should reject sort with valid field but wrong direction', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ sort: 'rating:asc' }),
      ).toThrow();
    });

    it('should reject page less than 1', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ page: 0 }),
      ).toThrow();
    });

    it('should reject negative page', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ page: -1 }),
      ).toThrow();
    });

    it('should reject limit greater than 100', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ limit: 101 }),
      ).toThrow();
    });

    it('should reject limit less than 1', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ limit: 0 }),
      ).toThrow();
    });

    it('should reject negative limit', () => {
      expect(() =>
        browseSkillsQuerySchema.parse({ limit: -5 }),
      ).toThrow();
    });
  });
});
