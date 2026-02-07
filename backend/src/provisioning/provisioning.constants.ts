/**
 * Provisioning Constants
 *
 * Step definitions, delays, and retry configuration for tenant container
 * provisioning. Based on API Contract v1.2.0 Section 3 (Create Tenant notes).
 *
 * Provisioning steps: creating_namespace -> spinning_container -> configuring
 *                     -> installing_skills -> health_check -> completed
 */

export const PROVISIONING_QUEUE_NAME = 'provisioning';

/**
 * Maximum number of retry attempts before marking provisioning as permanently failed.
 * On final failure, an Alert is created for the platform admin.
 */
export const MAX_PROVISIONING_RETRIES = 3;

/**
 * Provisioning step definitions, ordered by execution sequence.
 * Each step has a name, progress range, human-readable message, and simulated delay.
 */
export interface ProvisioningStepDefinition {
  /** Step identifier matching the API contract */
  name: string;
  /** Progress percentage at the start of this step */
  progressStart: number;
  /** Progress percentage at the end of this step */
  progressEnd: number;
  /** Human-readable message shown during this step */
  message: string;
  /** Simulated delay in milliseconds (for MVP, real provisioning would replace this) */
  delayMs: number;
}

export const PROVISIONING_STEPS: ProvisioningStepDefinition[] = [
  {
    name: 'creating_namespace',
    progressStart: 0,
    progressEnd: 20,
    message: 'Creating isolated namespace for tenant environment...',
    delayMs: 2000,
  },
  {
    name: 'spinning_container',
    progressStart: 20,
    progressEnd: 40,
    message: 'Spinning up OpenClaw container instance...',
    delayMs: 3000,
  },
  {
    name: 'configuring',
    progressStart: 40,
    progressEnd: 60,
    message: 'Configuring container with tenant settings and model defaults...',
    delayMs: 2000,
  },
  {
    name: 'installing_skills',
    progressStart: 60,
    progressEnd: 80,
    message: 'Installing default skill packages into container...',
    delayMs: 3000,
  },
  {
    name: 'health_check',
    progressStart: 80,
    progressEnd: 100,
    message: 'Running health checks to verify container readiness...',
    delayMs: 2000,
  },
];

/**
 * Default plan-based maxSkills limits (used when not explicitly provided).
 */
export const PLAN_MAX_SKILLS: Record<string, number> = {
  starter: 5,
  growth: 15,
  enterprise: 50,
};
