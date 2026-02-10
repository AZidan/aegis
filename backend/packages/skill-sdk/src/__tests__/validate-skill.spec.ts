import { validateSkill } from '../helpers/validate-skill';

const validHandler = async () => ({ success: true as const });

describe('validateSkill', () => {
  it('should report valid for a correct definition', () => {
    const report = validateSkill({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A valid test skill description',
      category: 'custom',
      compatibleRoles: ['engineering'],
      permissions: {
        network: { allowedDomains: ['api.example.com'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      },
      handler: validHandler,
    });
    expect(report.valid).toBe(true);
    expect(report.issues.filter(i => i.severity === 'error')).toHaveLength(0);
  });

  it('should report invalid for missing required fields', () => {
    const report = validateSkill({});
    expect(report.valid).toBe(false);
    expect(report.issues.some(i => i.severity === 'error')).toBe(true);
  });

  it('should warn about wildcard domain access', () => {
    const report = validateSkill({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill with wildcard access',
      category: 'custom',
      compatibleRoles: ['engineering'],
      permissions: {
        network: { allowedDomains: ['*'] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      },
      handler: validHandler,
    });
    expect(report.valid).toBe(true);
    expect(report.issues.some(i => i.severity === 'warning' && i.path.includes('network'))).toBe(true);
  });

  it('should warn about root write path', () => {
    const report = validateSkill({
      name: 'my-skill',
      version: '1.0.0',
      description: 'A skill with root write access',
      category: 'custom',
      compatibleRoles: ['engineering'],
      permissions: {
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: ['/'] },
        env: { required: [], optional: [] },
      },
      handler: validHandler,
    });
    expect(report.issues.some(i => i.severity === 'warning' && i.path.includes('writePaths'))).toBe(true);
  });

  it('should warn about select config without options', () => {
    const report = validateSkill({
      name: 'my-skill',
      version: '1.0.0',
      description: 'Skill with bad select config',
      category: 'custom',
      compatibleRoles: ['engineering'],
      permissions: {
        network: { allowedDomains: [] },
        files: { readPaths: [], writePaths: [] },
        env: { required: [], optional: [] },
      },
      config: [{ key: 'mode', label: 'Mode', type: 'select', required: true }],
      handler: validHandler,
    });
    expect(report.issues.some(i => i.message.includes('select'))).toBe(true);
  });
});
