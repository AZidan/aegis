/**
 * Role Default Policies - Default tool policy configurations per agent role.
 *
 * When creating an agent without an explicit toolPolicy, these defaults
 * are applied based on the agent's role. The allow/deny arrays reference
 * tool category IDs from tool-categories.ts.
 *
 * Role descriptions:
 * - pm: Product managers - analytics, project management, communication
 * - engineering: Engineers - code, devops, monitoring, search
 * - operations: Ops team - communication, monitoring, project management
 * - custom: Custom agents - minimal access (search, communication)
 */
export const ROLE_DEFAULT_POLICIES: Record<
  string,
  { allow: string[]; deny: string[] }
> = {
  pm: {
    allow: ['analytics', 'project_management', 'communication', 'web_search'],
    deny: ['devops', 'data_access'],
  },
  engineering: {
    allow: ['code_management', 'devops', 'monitoring', 'web_search'],
    deny: [],
  },
  operations: {
    allow: [
      'communication',
      'monitoring',
      'project_management',
      'web_search',
    ],
    deny: ['code_management', 'devops'],
  },
  custom: {
    allow: ['web_search', 'communication'],
    deny: ['devops', 'data_access'],
  },
};
