import type { Metadata } from 'next';
import { AdminLoginShell } from '@/components/auth/admin-login-shell';

export const metadata: Metadata = {
  title: 'Platform Admin Login - Aegis Platform',
  description: 'Sign in to manage the platform',
};

/**
 * Platform Admin Login Page
 * DSL: PA-01 - Admin Console
 * Full dark background with grid pattern, decorative shapes, shield logo
 */
export default function AdminLoginPage() {
  return <AdminLoginShell />;
}
