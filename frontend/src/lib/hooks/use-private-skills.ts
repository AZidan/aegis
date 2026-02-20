import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrivateSkills,
  fetchPrivateSkillDetail,
  fetchGitHubSkillsTenant,
  submitPrivateSkill,
  validatePrivateSkill,
  type PrivateSkill,
  type PrivateSkillDetail,
  type SubmitPrivateSkillPayload,
  type ValidateSkillPayload,
  type ValidationReport,
} from '@/lib/api/private-skills';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const privateSkillKeys = {
  all: ['private-skills'] as const,
  lists: (status?: string) => [...privateSkillKeys.all, 'list', status ?? 'all'] as const,
  detail: (id: string) => [...privateSkillKeys.all, 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePrivateSkills(status?: string) {
  return useQuery<{ data: PrivateSkill[] }>({
    queryKey: privateSkillKeys.lists(status),
    queryFn: () => fetchPrivateSkills(status),
    staleTime: 15_000,
  });
}

export function usePrivateSkillDetail(skillId: string | null) {
  return useQuery<PrivateSkillDetail>({
    queryKey: privateSkillKeys.detail(skillId ?? ''),
    queryFn: () => fetchPrivateSkillDetail(skillId!),
    enabled: !!skillId,
    staleTime: 30_000,
  });
}

export function useSubmitPrivateSkill() {
  const queryClient = useQueryClient();
  return useMutation<PrivateSkill, Error, SubmitPrivateSkillPayload>({
    mutationFn: submitPrivateSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privateSkillKeys.all });
    },
  });
}

export function useValidateSkill() {
  return useMutation<ValidationReport, Error, ValidateSkillPayload>({
    mutationFn: validatePrivateSkill,
  });
}

export function useFetchGitHubSkillsTenant() {
  return useMutation({
    mutationFn: (url: string) => fetchGitHubSkillsTenant(url),
  });
}
