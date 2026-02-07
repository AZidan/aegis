import type { Metadata } from 'next';
import { TenantLoginShell } from '@/components/auth/tenant-login-shell';

export const metadata: Metadata = {
  title: 'Sign In - Aegis Platform',
  description: 'Sign in to your workspace',
};

/**
 * Tenant Login Page
 * DSL: TA-01 - Welcome Back
 * Split layout: left gradient panel + right white form panel
 */
export default function LoginPage() {
  return <TenantLoginShell />;
}
