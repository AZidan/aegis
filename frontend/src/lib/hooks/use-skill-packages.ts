import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSkillsForReview,
  fetchSkillReviewDetail,
  reviewSkill,
  uploadSkillPackage,
  validateSkillPackage,
  submitSkillPackage,
  uploadMarketplacePackage,
  importMarketplaceSkill,
  fetchGitHubSkills,
  type SkillReviewItem,
  type SkillReviewDetail,
  type PackageValidationResult,
  type ImportMarketplaceSkillPayload,
  type GitHubImportResult,
} from '@/lib/api/skill-packages';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const skillPackageKeys = {
  all: ['skill-packages'] as const,
  review: (status?: string) => [...skillPackageKeys.all, 'review', status ?? 'default'] as const,
  reviewDetail: (id: string) =>
    [...skillPackageKeys.all, 'review', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Hooks — Admin Review Queue
// ---------------------------------------------------------------------------

export function useSkillsForReview(status?: string) {
  return useQuery<{ data: SkillReviewItem[] }>({
    queryKey: skillPackageKeys.review(status),
    queryFn: () => fetchSkillsForReview(status),
    staleTime: 15_000,
  });
}

export function useSkillReviewDetail(skillId: string | null) {
  return useQuery<SkillReviewDetail>({
    queryKey: skillPackageKeys.reviewDetail(skillId ?? ''),
    queryFn: () => fetchSkillReviewDetail(skillId!),
    enabled: !!skillId,
    staleTime: 30_000,
  });
}

export function useReviewSkill() {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; status: string },
    Error,
    { skillId: string; action: 'approve' | 'reject' | 'request_changes'; reviewNotes?: string }
  >({
    mutationFn: ({ skillId, action, reviewNotes }) =>
      reviewSkill(skillId, { action, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillPackageKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks — Package Upload / Validate
// ---------------------------------------------------------------------------

export function useUploadSkillPackage() {
  const queryClient = useQueryClient();
  return useMutation<PackageValidationResult, Error, File>({
    mutationFn: uploadSkillPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-skills'] });
    },
  });
}

export function useValidateSkillPackage() {
  return useMutation<PackageValidationResult, Error, File>({
    mutationFn: validateSkillPackage,
  });
}

export function useSubmitSkillPackage() {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; status: string },
    Error,
    PackageValidationResult
  >({
    mutationFn: submitSkillPackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-skills'] });
      queryClient.invalidateQueries({ queryKey: skillPackageKeys.review() });
    },
  });
}

// ---------------------------------------------------------------------------
// Hooks — Marketplace Import
// ---------------------------------------------------------------------------

export function useUploadMarketplacePackage() {
  return useMutation<PackageValidationResult, Error, File>({
    mutationFn: uploadMarketplacePackage,
  });
}

export function useFetchGitHubSkills() {
  return useMutation<GitHubImportResult, Error, string>({
    mutationFn: fetchGitHubSkills,
  });
}

export function useImportMarketplaceSkill() {
  const queryClient = useQueryClient();
  return useMutation<
    { id: string; name: string; version: string; status: string; submittedAt: string },
    Error,
    ImportMarketplaceSkillPayload
  >({
    mutationFn: importMarketplaceSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillPackageKeys.review() });
    },
  });
}
