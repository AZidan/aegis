/**
 * Tool Categories - Static configuration for agent tool policy management.
 *
 * Defines the available tool categories that can be assigned to agents
 * via their toolPolicy allow/deny lists (API Contract v1.2.0 Section 6).
 *
 * Each category groups related tools and assigns a risk level to guide
 * role-based default policies.
 */

export interface ToolCategory {
  /** Unique identifier used in toolPolicy allow/deny arrays */
  id: string;
  /** Human-readable category name */
  name: string;
  /** Brief description of the category's tools */
  description: string;
  /** Individual tool names within this category */
  tools: string[];
  /** Risk level for default policy decisions */
  riskLevel: 'low' | 'medium' | 'high';
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'analytics',
    name: 'Analytics & BI',
    description: 'Tableau, Amplitude, Google Analytics integrations',
    tools: ['tableau', 'amplitude', 'google_analytics', 'mixpanel'],
    riskLevel: 'low',
  },
  {
    id: 'project_management',
    name: 'Project Management',
    description: 'Jira, Linear, Asana task management',
    tools: ['jira', 'linear', 'asana', 'trello'],
    riskLevel: 'low',
  },
  {
    id: 'code_management',
    name: 'Code Management',
    description: 'GitHub, GitLab, Bitbucket repository access',
    tools: ['github', 'gitlab', 'bitbucket'],
    riskLevel: 'medium',
  },
  {
    id: 'devops',
    name: 'DevOps & Infrastructure',
    description: 'AWS, Docker, Kubernetes, Terraform',
    tools: ['aws', 'docker', 'kubernetes', 'terraform', 'cloudflare'],
    riskLevel: 'high',
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Slack, Teams, email integrations',
    tools: ['slack', 'teams', 'email', 'telegram'],
    riskLevel: 'low',
  },
  {
    id: 'monitoring',
    name: 'Monitoring & Alerting',
    description: 'Sentry, Datadog, PagerDuty',
    tools: ['sentry', 'datadog', 'pagerduty', 'grafana'],
    riskLevel: 'medium',
  },
  {
    id: 'data_access',
    name: 'Data Access',
    description: 'Database queries, file system, API access',
    tools: ['sql_query', 'file_read', 'file_write', 'api_call'],
    riskLevel: 'high',
  },
  {
    id: 'web_search',
    name: 'Web Search & Research',
    description: 'Web browsing, search engines, documentation',
    tools: ['web_search', 'web_browse', 'documentation'],
    riskLevel: 'low',
  },
];
