import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/register-form';
import { AuthCardLayout } from '@/components/auth/auth-card-layout';

export const metadata: Metadata = {
  title: 'Create Account - Aegis Platform',
  description: 'Create your Aegis Platform account',
};

/**
 * Register page
 * Client-side form handling with server-rendered page shell
 */
export default function RegisterPage() {
  return (
    <AuthCardLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Get started with Aegis Platform
          </p>
        </div>

        <RegisterForm />
      </div>
    </AuthCardLayout>
  );
}
