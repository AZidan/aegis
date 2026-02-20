import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Normalized permission manifest from backend (v2 format) */
export interface SkillPermissions {
  network: { allowedDomains: string[] };
  files: { readPaths: string[]; writePaths: string[] };
  env: { required: string[]; optional: string[] };
}

/** Helper: flatten permissions to string arrays for display */
export function flattenPermissions(p: SkillPermissions) {
  return {
    network: p.network?.allowedDomains ?? [],
    files: [
      ...(p.files?.readPaths ?? []).map((f) => `read: ${f}`),
      ...(p.files?.writePaths ?? []).map((f) => `write: ${f}`),
    ],
    env: [
      ...(p.env?.required ?? []).map((e) => `${e} (required)`),
      ...(p.env?.optional ?? []).map((e) => `${e} (optional)`),
    ],
  };
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  version: string;
  rating: number;
  installCount: number;
  permissions: SkillPermissions;
  installed: boolean;
}

export interface SkillReview {
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

export interface InstalledAgent {
  id: string;
  name: string;
}

export interface SkillDetail extends Skill {
  documentation: string;
  changelog: string;
  reviews: SkillReview[];
  installedAgents?: InstalledAgent[];
}

export interface InstalledSkill {
  id: string;
  name: string;
  version: string;
  category: string;
  agentId: string;
  agentName: string;
  installedAt: string;
  usageCount: number;
}

export interface SkillFilters {
  category?: string;
  role?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface InstallSkillPayload {
  agentId: string;
  credentials?: Record<string, string>;
  acceptPermissions?: boolean;
}

export interface InstallSkillResponse {
  skillId: string;
  agentId: string;
  status: 'installing';
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchSkills(
  filters?: SkillFilters
): Promise<{ data: Skill[]; meta: PaginationMeta }> {
  const { data } = await api.get<{ data: Skill[]; meta: PaginationMeta }>(
    '/dashboard/skills',
    { params: filters }
  );
  return data;
}

export async function fetchSkillDetail(id: string): Promise<SkillDetail> {
  const { data } = await api.get<SkillDetail>(`/dashboard/skills/${id}`);
  return data;
}

export async function installSkill(
  skillId: string,
  payload: InstallSkillPayload
): Promise<InstallSkillResponse> {
  const { data } = await api.post<InstallSkillResponse>(
    `/dashboard/skills/${skillId}/install`,
    payload
  );
  return data;
}

export async function uninstallSkill(
  skillId: string,
  agentId: string
): Promise<void> {
  await api.delete(`/dashboard/skills/${skillId}/uninstall`, {
    params: { agentId },
  });
}

export async function fetchInstalledSkills(
  agentId?: string
): Promise<InstalledSkill[]> {
  const { data } = await api.get<{ data: InstalledSkill[] }>(
    '/dashboard/skills/installed',
    { params: agentId ? { agentId } : undefined }
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

export const SKILL_CATEGORY_LABELS: Record<string, string> = {
  productivity: 'Productivity',
  analytics: 'Analytics',
  engineering: 'Engineering',
  communication: 'Communication',
};

export const SKILL_CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string }
> = {
  productivity: { bg: 'bg-blue-50', text: 'text-blue-700' },
  analytics: { bg: 'bg-purple-50', text: 'text-purple-700' },
  engineering: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  communication: { bg: 'bg-amber-50', text: 'text-amber-700' },
};
