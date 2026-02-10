export const testTemplate = (name: string) => `import { validateSkill } from '@aegis/skill-sdk';
import skill from './skill';

describe('${name}', () => {
  it('should have a valid skill definition', () => {
    const report = validateSkill(skill);
    expect(report.valid).toBe(true);
  });

  it('should execute successfully', async () => {
    const mockContext = {
      executionId: 'test-exec-1',
      agentId: 'test-agent',
      tenantId: 'test-tenant',
      config: {},
      env: { API_KEY: 'test-key' },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    const result = await skill.handler({}, mockContext);
    expect(result.success).toBe(true);
  });
});
`;
