import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmitPrivateSkillPayload {
  name: string;
  version: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  sourceCode: string;
  permissions: {
    network: { allowedDomains: string[] };
    files: { readPaths: string[]; writePaths: string[] };
    env: { required: string[]; optional: string[] };
  };
  documentation?: string;
}

export interface PrivateSkill {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  status: 'pending' | 'approved' | 'rejected';
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidateSkillPayload {
  sourceCode: string;
  dryRun: boolean;
}

export interface ValidationIssue {
  type: string;
  message: string;
  severity: 'error' | 'warning';
  line?: number;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchPrivateSkills(): Promise<{ data: PrivateSkill[] }> {
  const { data } = await api.get<{ data: PrivateSkill[] }>(
    '/dashboard/skills/private',
  );
  return data;
}

export async function submitPrivateSkill(
  payload: SubmitPrivateSkillPayload,
): Promise<PrivateSkill> {
  const { data } = await api.post<PrivateSkill>(
    '/dashboard/skills/private',
    payload,
  );
  return data;
}

export async function validatePrivateSkill(
  payload: ValidateSkillPayload,
): Promise<ValidationReport> {
  const { data } = await api.post<ValidationReport>(
    '/dashboard/skills/private/validate',
    payload,
  );
  return data;
}
