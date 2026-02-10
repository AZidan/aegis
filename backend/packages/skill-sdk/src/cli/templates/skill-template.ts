export const skillTemplate = (name: string) => `import { createSkill, definePermissions } from '@aegis/skill-sdk';

const permissions = definePermissions()
  .allowDomains('api.example.com')
  .requireEnv('API_KEY')
  .build();

export default createSkill({
  name: '${name}',
  version: '1.0.0',
  description: 'TODO: Describe your skill',
  category: 'custom',
  compatibleRoles: ['engineering'],
  permissions,
  handler: async (input, context) => {
    context.logger.info('Executing ${name}', { input });

    // TODO: Implement your skill logic here

    return {
      success: true,
      data: { message: 'Hello from ${name}!' },
      message: 'Skill executed successfully',
    };
  },
});
`;
