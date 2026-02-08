import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillPermissions {
  network: string[];
  files: string[];
  env: string[];
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

export interface SkillDetail extends Skill {
  documentation: string;
  changelog: string;
  reviews: SkillReview[];
  installedAgents?: string[];
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
