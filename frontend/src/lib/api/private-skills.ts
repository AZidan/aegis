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
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'changes_requested';
  tenantId: string;
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateSkillDetail extends PrivateSkill {
  author: string;
  sourceCode: string | null;
  documentation: string | null;
  permissions: Record<string, unknown>;
  llmReview?: Record<string, unknown> | null;
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

export async function fetchPrivateSkills(status?: string): Promise<{ data: PrivateSkill[] }> {
  const params = status ? `?status=${status}` : '';
  const { data } = await api.get<{ data: PrivateSkill[] }>(
    `/dashboard/skills/private${params}`,
  );
  return data;
}

export async function fetchPrivateSkillDetail(skillId: string): Promise<PrivateSkillDetail> {
  const { data } = await api.get<PrivateSkillDetail>(
    `/dashboard/skills/private/${skillId}`,
  );
  return data;
}

export async function fetchGitHubSkillsTenant(url: string): Promise<{
  repoUrl: string;
  skills: Array<{
    name: string;
    version: string;
    description: string;
    category: string;
    compatibleRoles: string[];
    sourceCode: string;
    documentation: string;
    permissions: Record<string, unknown>;
    skillPath: string;
  }>;
}> {
  const { data } = await api.post('/dashboard/skills/private/import/github', { url });
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
