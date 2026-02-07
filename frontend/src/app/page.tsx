'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { ROUTES } from '@/lib/constants';

/**
 * Landing page - redirects based on authentication state
 * - Authenticated platform admin → /admin/dashboard
 * - Authenticated tenant user → /dashboard
 * - Not authenticated → /login
 */
export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      // Redirect based on role
      if (user.role === 'platform_admin') {
        router.push(ROUTES.ADMIN_DASHBOARD);
      } else {
        router.push(ROUTES.DASHBOARD);
      }
    } else {
      // Not authenticated, redirect to login
      router.push(ROUTES.LOGIN);
    }
  }, [isAuthenticated, user, router]);

  // Show loading state while redirecting
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <p className="text-sm text-neutral-500">Loading Aegis Platform...</p>
      </div>
    </div>
  );
}
