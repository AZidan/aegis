/**
 * Role Default Policies - Default tool policy configurations per agent role.
 *
 * When creating an agent without an explicit toolPolicy, these defaults
 * are applied based on the agent's role. The allow arrays reference
 * tool category IDs from tool-categories.ts.
 *
 * Per API Contract v1.3.0: allow-only model (no deny).
 *
 * Role descriptions:
 * - pm: Product managers - analytics, project management, communication
 * - engineering: Engineers - code, devops, monitoring, search
 * - operations: Ops team - communication, monitoring, project management
 * - support: Customer support - communication, search
 * - data: Data & Analytics - analytics, data access, search
 * - hr: Human Resources - communication, search
 * - custom: Custom agents - minimal access (search, communication)
 */
export const ROLE_DEFAULT_POLICIES: Record<
  string,
  { allow: string[] }
> = {
  pm: {
    allow: ['analytics', 'project_management', 'communication', 'web_search'],
  },
  engineering: {
    allow: ['code_management', 'devops', 'monitoring', 'web_search'],
  },
  operations: {
    allow: [
      'communication',
      'monitoring',
      'project_management',
      'web_search',
    ],
  },
  support: {
    allow: ['communication', 'web_search'],
  },
  data: {
    allow: ['analytics', 'data_access', 'web_search'],
  },
  hr: {
    allow: ['communication', 'web_search'],
  },
  custom: {
    allow: ['web_search', 'communication'],
  },
};
