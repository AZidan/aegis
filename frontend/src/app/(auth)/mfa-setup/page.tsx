import type { Metadata } from 'next';
import { MfaSetupForm } from '@/components/auth/mfa-setup-form';
import { AuthCardLayout } from '@/components/auth/auth-card-layout';

export const metadata: Metadata = {
  title: 'Set Up MFA - Aegis Platform',
  description: 'Set up multi-factor authentication for your Aegis Platform account',
};

/**
 * MFA Setup page
 * Protected route - requires authenticated user
 */
export default function MfaSetupPage() {
  return (
    <AuthCardLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Set up two-factor authentication
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add an extra layer of security to your account
          </p>
        </div>

        <MfaSetupForm />
      </div>
    </AuthCardLayout>
  );
}
