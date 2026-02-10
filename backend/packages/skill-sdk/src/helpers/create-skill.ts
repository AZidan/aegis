import { z } from 'zod';
import { SkillDefinition, SkillCategory } from '../types/skill-definition';

const SKILL_NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
const VALID_CATEGORIES: SkillCategory[] = [
  'productivity', 'communication', 'analytics', 'security', 'integration', 'custom',
];

const skillSchema = z.object({
  name: z.string().min(3).max(64).regex(SKILL_NAME_REGEX, 'Skill name must be kebab-case (e.g. "my-skill")'),
  version: z.string().regex(SEMVER_REGEX, 'Version must be semver (e.g. "1.0.0")'),
  description: z.string().min(10).max(500),
  category: z.enum(VALID_CATEGORIES as [SkillCategory, ...SkillCategory[]]),
  compatibleRoles: z.array(z.string()).min(1, 'At least one compatible role required'),
  permissions: z.object({
    network: z.object({ allowedDomains: z.array(z.string()) }),
    files: z.object({ readPaths: z.array(z.string()), writePaths: z.array(z.string()) }),
    env: z.object({ required: z.array(z.string()), optional: z.array(z.string()) }),
  }),
  config: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
    type: z.enum(['string', 'number', 'boolean', 'select']),
    required: z.boolean(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
  handler: z.function(),
});

/**
 * Creates a validated SkillDefinition. Throws if validation fails.
 */
export function createSkill(definition: SkillDefinition): SkillDefinition {
  const result = skillSchema.safeParse(definition);
  if (!result.success) {
    const errors = result.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(
      `Invalid skill definition:\n${errors.join('\n')}`,
    );
  }
  return definition;
}

export { skillSchema };
