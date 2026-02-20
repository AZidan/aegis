/**
 * Skill Deployment Interfaces
 *
 * Types for container-based skill deployment (Sprint 10 - S10-03).
 */

export interface DeploymentResult {
  installationId: string;
  agentId: string;
  skillName: string;
  skillVersion: string;
  status: 'deploying' | 'deployed' | 'failed' | 'uninstalled';
  message?: string;
}

export interface DeployJobPayload {
  installationId: string;
  agentId: string;
  skillId: string;
  skillName: string;
  skillVersion: string;
  tenantId: string;
  packagePath: string | null;
  sourceCode: string | null;
  documentation: string | null;
  permissions: Record<string, unknown>;
  envConfig: Record<string, string> | null;
}

export interface UndeployJobPayload {
  installationId: string;
  agentId: string;
  skillName: string;
  tenantId: string;
}
