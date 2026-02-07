/**
 * Auth layout group - minimal wrapper
 * Each auth page manages its own layout:
 * - admin/login: full dark background (PA-01 design)
 * - login: split layout with left panel (TA-01 design)
 * - register, mfa-setup, mfa-verify: use AuthCardLayout component
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
