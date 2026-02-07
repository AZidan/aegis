import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Welcome Back - Aegis Platform',
  description: 'Sign in to your workspace',
};

/**
 * Tenant Login Page
 * DSL: TA-01 - Welcome Back
 */
export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Welcome Back
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in to your workspace
        </p>
      </div>

      <LoginForm variant="tenant" />
    </div>
  );
}
