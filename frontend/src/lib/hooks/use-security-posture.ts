import { useQuery } from '@tanstack/react-query';
import {
  fetchSecurityPosture,
  type SecurityPosture,
} from '@/lib/api/security-posture';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const securityPostureKeys = {
  all: ['security-posture'] as const,
  detail: () => [...securityPostureKeys.all, 'detail'] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSecurityPosture() {
  return useQuery<SecurityPosture>({
    queryKey: securityPostureKeys.detail(),
    queryFn: fetchSecurityPosture,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
