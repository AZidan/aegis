import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Admin Console - Aegis Platform',
  description: 'Sign in to manage the platform',
};

/**
 * Platform Admin Login Page
 * DSL: PA-01 - Admin Console
 */
export default function AdminLoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Admin Console
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in to manage the platform
        </p>
      </div>

      <LoginForm variant="admin" />
    </div>
  );
}
