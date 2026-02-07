import type { Metadata } from 'next';
import { MfaVerifyForm } from '@/components/auth/mfa-verify-form';

export const metadata: Metadata = {
  title: 'Verify MFA - Aegis Platform',
  description: 'Enter your multi-factor authentication code',
};

/**
 * MFA Verification page
 * Shown after login when MFA is required
 */
export default function MfaVerifyPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Two-factor authentication
        </h2>
      </div>

      <MfaVerifyForm />
    </div>
  );
}
