import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types — Package Validation
// ---------------------------------------------------------------------------

export interface PackageValidationIssue {
  severity: 'error' | 'warning' | 'info';
  file?: string;
  message: string;
}

export interface PackageFileInfo {
  path: string;
  size: number;
  type: string;
}

export interface PackageValidationResult {
  valid: boolean;
  packageId?: string;
  packagePath?: string;
  manifest: Record<string, unknown> | null;
  skillMd: { title: string; description: string; rawContent: string } | null;
  files: PackageFileInfo[];
  issues: PackageValidationIssue[];
}

// ---------------------------------------------------------------------------
// Types — Admin Skill Review
// ---------------------------------------------------------------------------

export interface LlmFinding {
  category: string;
  severity: string;
  description: string;
  recommendation: string;
}

export interface LlmReview {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: LlmFinding[];
  summary: string;
  reviewedAt: string;
}

export interface SkillReviewItem {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  author: string;
  tenantId: string | null;
  tenantName: string;
  type: 'private' | 'marketplace';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'changes_requested';
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  llmReview?: LlmReview;
}

export interface SkillReviewDetail extends SkillReviewItem {
  sourceCode: string;
  documentation: string;
  permissions: Record<string, unknown>;
  compatibleRoles: string[];
}

// ---------------------------------------------------------------------------
// API Functions — Tenant (Package Upload / Validate)
// ---------------------------------------------------------------------------

export async function uploadSkillPackage(
  file: File,
): Promise<PackageValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<PackageValidationResult>(
    '/dashboard/skills/package/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function validateSkillPackage(
  file: File,
): Promise<PackageValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<PackageValidationResult>(
    '/dashboard/skills/package/validate',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/**
 * Submit a validated skill package for review.
 * Calls POST /dashboard/skills/private with data extracted from the package.
 */
export async function submitSkillPackage(
  result: PackageValidationResult,
): Promise<{ id: string; status: string }> {
  const manifest = result.manifest as {
    name: string;
    version: string;
    description: string;
    category: string;
    compatibleRoles: string[];
    permissions: Record<string, unknown>;
  };

  const { data } = await api.post<{ id: string; status: string }>(
    '/dashboard/skills/private',
    {
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      category: manifest.category,
      compatibleRoles: manifest.compatibleRoles,
      sourceCode: result.skillMd?.rawContent ?? '',
      permissions: manifest.permissions,
      documentation: result.skillMd?.description,
      packageId: result.packageId,
    },
  );
  return data;
}

// ---------------------------------------------------------------------------
// API Functions — Admin (Skill Review)
// ---------------------------------------------------------------------------

export async function fetchSkillsForReview(status?: string): Promise<{
  data: SkillReviewItem[];
}> {
  const params = status ? `?status=${status}` : '';
  const { data } = await api.get<{ data: SkillReviewItem[] }>(
    `/admin/skills/review${params}`,
  );
  return data;
}

export async function fetchSkillReviewDetail(
  skillId: string,
): Promise<SkillReviewDetail> {
  const { data } = await api.get<SkillReviewDetail>(
    `/admin/skills/review/${skillId}`,
  );
  return data;
}

export async function reviewSkill(
  skillId: string,
  payload: { action: 'approve' | 'reject' | 'request_changes'; reviewNotes?: string },
): Promise<{ id: string; status: string }> {
  if (payload.action === 'approve') {
    const { data } = await api.put<{ id: string; status: string }>(
      `/admin/skills/review/${skillId}/approve`,
    );
    return data;
  } else if (payload.action === 'request_changes') {
    const { data } = await api.put<{ id: string; status: string }>(
      `/admin/skills/review/${skillId}/request-changes`,
      { reason: payload.reviewNotes },
    );
    return data;
  } else {
    const { data } = await api.put<{ id: string; status: string }>(
      `/admin/skills/review/${skillId}/reject`,
      { reason: payload.reviewNotes },
    );
    return data;
  }
}

// ---------------------------------------------------------------------------
// Types — GitHub Import
// ---------------------------------------------------------------------------

export interface SkillCompanionFile {
  relativePath: string;
  content: string;
}

export interface DiscoveredGitHubSkill {
  name: string;
  version: string;
  description: string;
  category: string;
  compatibleRoles: string[];
  sourceCode: string;
  documentation: string;
  permissions: {
    network: { allowedDomains: string[] };
    files: { readPaths: string[]; writePaths: string[] };
    env: { required: string[]; optional: string[] };
  };
  skillPath: string;
  companionFiles: SkillCompanionFile[];
}

export interface GitHubImportResult {
  repoUrl: string;
  skills: DiscoveredGitHubSkill[];
}

// ---------------------------------------------------------------------------
// API Functions — Admin (GitHub Import)
// ---------------------------------------------------------------------------

export async function fetchGitHubSkills(
  url: string,
): Promise<GitHubImportResult> {
  const { data } = await api.post<GitHubImportResult>(
    '/admin/skills/review/import/github',
    { url },
  );
  return data;
}

// ---------------------------------------------------------------------------
// API Functions — Admin (Marketplace Import)
// ---------------------------------------------------------------------------

export interface ImportMarketplaceSkillPayload {
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
  packageId?: string;
}

export async function uploadMarketplacePackage(
  file: File,
): Promise<PackageValidationResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<PackageValidationResult>(
    '/admin/skills/review/import/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function importMarketplaceSkill(
  payload: ImportMarketplaceSkillPayload,
): Promise<{ id: string; name: string; version: string; status: string; submittedAt: string }> {
  const { data } = await api.post<{ id: string; name: string; version: string; status: string; submittedAt: string }>(
    '/admin/skills/review/import',
    payload,
  );
  return data;
}
