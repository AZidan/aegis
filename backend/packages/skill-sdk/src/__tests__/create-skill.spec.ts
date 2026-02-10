import { createSkill } from '../helpers/create-skill';
import { SkillDefinition } from '../types';

const validHandler = async () => ({ success: true as const, data: {} });

const validDef: SkillDefinition = {
  name: 'test-skill',
  version: '1.0.0',
  description: 'A valid test skill for unit testing',
  category: 'custom',
  compatibleRoles: ['engineering'],
  permissions: {
    network: { allowedDomains: ['api.example.com'] },
    files: { readPaths: [], writePaths: [] },
    env: { required: [], optional: [] },
  },
  handler: validHandler,
};

describe('createSkill', () => {
  it('should return the definition for a valid skill', () => {
    const result = createSkill(validDef);
    expect(result.name).toBe('test-skill');
    expect(result.version).toBe('1.0.0');
  });

  it('should throw for invalid name (not kebab-case)', () => {
    expect(() => createSkill({ ...validDef, name: 'Bad Name!' })).toThrow('Invalid skill definition');
  });

  it('should throw for invalid version', () => {
    expect(() => createSkill({ ...validDef, version: 'abc' })).toThrow('Invalid skill definition');
  });

  it('should throw for empty compatibleRoles', () => {
    expect(() => createSkill({ ...validDef, compatibleRoles: [] })).toThrow('Invalid skill definition');
  });

  it('should throw for too-short description', () => {
    expect(() => createSkill({ ...validDef, description: 'short' })).toThrow('Invalid skill definition');
  });

  it('should accept optional config options', () => {
    const withConfig = {
      ...validDef,
      config: [{
        key: 'apiUrl',
        label: 'API URL',
        type: 'string' as const,
        required: true,
      }],
    };
    const result = createSkill(withConfig);
    expect(result.config).toHaveLength(1);
  });
});
