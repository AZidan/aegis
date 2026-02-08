import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchSkills,
  fetchSkillDetail,
  installSkill,
  uninstallSkill,
  fetchInstalledSkills,
  type SkillFilters,
  type InstallSkillPayload,
} from '@/lib/api/skills';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const skillKeys = {
  all: ['skills'] as const,
  lists: () => [...skillKeys.all, 'list'] as const,
  list: (filters?: SkillFilters) => [...skillKeys.lists(), filters] as const,
  details: () => [...skillKeys.all, 'detail'] as const,
  detail: (id: string) => [...skillKeys.details(), id] as const,
  installed: (agentId?: string) =>
    [...skillKeys.all, 'installed', agentId] as const,
};

// ---------------------------------------------------------------------------
// Browse Skills (Marketplace)
// ---------------------------------------------------------------------------

export function useSkills(filters?: SkillFilters) {
  return useQuery({
    queryKey: skillKeys.list(filters),
    queryFn: () => fetchSkills(filters),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Skill Detail
// ---------------------------------------------------------------------------

export function useSkillDetail(id: string) {
  return useQuery({
    queryKey: skillKeys.detail(id),
    queryFn: () => fetchSkillDetail(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Install Skill
// ---------------------------------------------------------------------------

export function useInstallSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      skillId,
      payload,
    }: {
      skillId: string;
      payload: InstallSkillPayload;
    }) => installSkill(skillId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: skillKeys.detail(variables.skillId),
      });
      queryClient.invalidateQueries({
        queryKey: skillKeys.installed(),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Uninstall Skill
// ---------------------------------------------------------------------------

export function useUninstallSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      skillId,
      agentId,
    }: {
      skillId: string;
      agentId: string;
    }) => uninstallSkill(skillId, agentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: skillKeys.detail(variables.skillId),
      });
      queryClient.invalidateQueries({
        queryKey: skillKeys.installed(),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Installed Skills
// ---------------------------------------------------------------------------

export function useInstalledSkills(agentId?: string) {
  return useQuery({
    queryKey: skillKeys.installed(agentId),
    queryFn: () => fetchInstalledSkills(agentId),
    staleTime: 15_000,
  });
}
