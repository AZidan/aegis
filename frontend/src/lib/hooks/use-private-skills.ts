import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrivateSkills,
  submitPrivateSkill,
  validatePrivateSkill,
  type PrivateSkill,
  type SubmitPrivateSkillPayload,
  type ValidateSkillPayload,
  type ValidationReport,
} from '@/lib/api/private-skills';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const privateSkillKeys = {
  all: ['private-skills'] as const,
  lists: () => [...privateSkillKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePrivateSkills() {
  return useQuery<{ data: PrivateSkill[] }>({
    queryKey: privateSkillKeys.lists(),
    queryFn: fetchPrivateSkills,
    staleTime: 15_000,
  });
}

export function useSubmitPrivateSkill() {
  const queryClient = useQueryClient();
  return useMutation<PrivateSkill, Error, SubmitPrivateSkillPayload>({
    mutationFn: submitPrivateSkill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: privateSkillKeys.lists() });
    },
  });
}

export function useValidateSkill() {
  return useMutation<ValidationReport, Error, ValidateSkillPayload>({
    mutationFn: validatePrivateSkill,
  });
}
