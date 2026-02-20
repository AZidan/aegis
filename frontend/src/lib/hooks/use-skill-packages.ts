import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSkillsForReview,
  fetchSkillReviewDetail,
  reviewSkill,
  uploadSkillPackage,
  validateSkillPackage,
  submitSkillPackage,
  type SkillReviewItem,
  type SkillReviewDetail,
  type PackageValidationResult,
} from '@/lib/api/skill-packages';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const skillPackageKeys = {
  all: ['skill-packages'] as const,
  review: () => [...skillPackageKeys.all, 'review'] as const,
  reviewDetail: (id: string) =>
    [...skillPackageKeys.all, 'review', id] as const,
};

// ---------------------------------------------------------------------------
// Hooks — Admin Review Queue
// ---------------------------------------------------------------------------

export function useSkillsForReview() {
  return useQuery<{ data: SkillReviewItem[] }>({
    queryKey: skillPackageKeys.review(),
    queryFn: fetchSkillsForReview,
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
    { skillId: string; action: 'approve' | 'reject'; reviewNotes?: string }
  >({
    mutationFn: ({ skillId, action, reviewNotes }) =>
      reviewSkill(skillId, { action, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillPackageKeys.review() });
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
