/**
 * Workflow Module Constants
 * Sprint 7 — S7-01
 */

export const WORKFLOW_QUEUE_NAME = 'workflow-execution';

/** Default step timeout: 5 minutes */
export const DEFAULT_STEP_TIMEOUT_MS = 5 * 60 * 1000;

/** Maximum steps per template */
export const MAX_STEPS_PER_TEMPLATE = 20;

/** Built-in template names */
export const BUILTIN_TEMPLATE_NAMES = [
  'daily_sync',
  'weekly_standup',
  'sprint_handoff',
] as const;
