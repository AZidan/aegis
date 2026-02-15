'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { STORAGE_KEYS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteInfo {
  email: string;
  companyName: string;
  expiresAt: string;
}

interface AcceptResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
  };
}

type PageState = 'loading' | 'ready' | 'submitting' | 'expired' | 'invalid' | 'used';

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  // State
  const [pageState, setPageState] = React.useState<PageState>('loading');
  const [inviteInfo, setInviteInfo] = React.useState<InviteInfo | null>(null);
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Fetch invite info on mount
  React.useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await api.get<InviteInfo>(`/auth/invite/${token}`);
        setInviteInfo(res.data);
        setPageState('ready');
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
          setPageState('invalid');
        } else if (status === 410) {
          const message = err?.response?.data?.message || '';
          if (message.includes('already been used')) {
            setPageState('used');
          } else {
            setPageState('expired');
          }
        } else {
          setPageState('invalid');
        }
      }
    }
    fetchInvite();
  }, [token]);

  // Validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Name is required';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 12) {
      errors.password = 'Password must be at least 12 characters';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setPageState('submitting');

    try {
      const res = await api.post<AcceptResponse>(
        `/auth/invite/${token}/accept`,
        { name: name.trim(), password },
      );

      // Store auth tokens
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.data.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.data.user));

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setPageState('ready');
      const status = err?.response?.status;
      if (status === 410) {
        setPageState('expired');
      } else if (status === 404) {
        setPageState('invalid');
      } else {
        setError(
          err?.response?.data?.message ||
            'Failed to accept invitation. Please try again.',
        );
      }
    }
  };

  // ---- Error States ----

  if (pageState === 'loading') {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-4" />
          <p className="text-sm text-neutral-500">Loading invitation...</p>
        </div>
      </PageShell>
    );
  }

  if (pageState === 'invalid') {
    return (
      <PageShell>
        <ErrorCard
          title="Invalid Invitation"
          message="This invitation link is invalid or does not exist. Please check the link or contact your administrator."
        />
      </PageShell>
    );
  }

  if (pageState === 'expired') {
    return (
      <PageShell>
        <ErrorCard
          title="Invitation Expired"
          message="This invitation link has expired. Please contact your administrator to receive a new invitation."
        />
      </PageShell>
    );
  }

  if (pageState === 'used') {
    return (
      <PageShell>
        <ErrorCard
          title="Invitation Already Used"
          message="This invitation has already been accepted. If you need to log in, please use the login page."
          actionLabel="Go to Login"
          actionHref="/login"
        />
      </PageShell>
    );
  }

  // ---- Ready / Submitting State ----

  return (
    <PageShell>
      <div className="w-full max-w-md">
        {/* Company badge */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-100 rounded-full px-4 py-1.5 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <span className="text-[13px] font-medium text-primary-700">
              {inviteInfo?.companyName}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-1">
            Set Up Your Account
          </h2>
          <p className="text-sm text-neutral-500">
            You&apos;ve been invited as a <span className="font-medium text-neutral-700">Tenant Admin</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={inviteInfo?.email || ''}
              readOnly
              className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-500 text-[14px] cursor-not-allowed"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name)
                  setFieldErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="Enter your full name"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 ${
                fieldErrors.name
                  ? 'border-rose-300 bg-rose-50/50'
                  : 'border-neutral-200 bg-white'
              }`}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-[12px] text-rose-500">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password)
                    setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Min. 12 characters"
                className={`w-full px-3.5 py-2.5 pr-10 rounded-lg border text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 ${
                  fieldErrors.password
                    ? 'border-rose-300 bg-rose-50/50'
                    : 'border-neutral-200 bg-white'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-[12px] text-rose-500">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[13px] font-medium text-neutral-700 mb-1.5">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword)
                  setFieldErrors((prev) => ({
                    ...prev,
                    confirmPassword: '',
                  }));
              }}
              placeholder="Repeat your password"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-[14px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 ${
                fieldErrors.confirmPassword
                  ? 'border-rose-300 bg-rose-50/50'
                  : 'border-neutral-200 bg-white'
              }`}
            />
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-[12px] text-rose-500">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* General error */}
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3">
              <p className="text-[13px] text-rose-700">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={pageState === 'submitting'}
            className="w-full py-2.5 rounded-lg bg-primary-500 text-white text-[14px] font-semibold hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-primary-500/20"
          >
            {pageState === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* OAuth divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-neutral-400">
              or continue with
            </span>
          </div>
        </div>

        {/* OAuth buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pageState === 'submitting'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 text-[14px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>
          <button
            type="button"
            disabled={pageState === 'submitting'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 text-[14px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </button>
        </div>
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Shell - Split layout matching tenant-login-shell pattern
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left panel - Brand gradient */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center px-12"
        style={{
          background:
            'linear-gradient(135deg, #4f46e5 0%, #6d28d9 50%, #7c3aed 100%)',
        }}
      >
        {/* Decorative shapes */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full border border-white/10" />
          <div className="absolute top-20 right-12 w-24 h-24 rounded-2xl bg-white/5" />
          <div className="absolute top-1/3 -left-8 w-40 h-40 rounded-full border-2 border-white/[0.07]" />
          <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-white/[0.04]" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/10 to-transparent" />
        </div>

        <div className="relative z-10 text-center max-w-md">
          {/* Shield logo */}
          <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg shadow-black/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" strokeWidth="2" />
            </svg>
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
            Aegis Platform
          </h1>
          <p className="text-lg text-white/70 mb-12 leading-relaxed">
            Deploy AI Agent Teams with
            <br />
            Enterprise Security
          </p>

          <div className="space-y-4 text-left inline-block">
            {[
              'Container-level tenant isolation',
              'Verified skill marketplace',
              'Full audit trails',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="text-white/80 text-sm font-medium">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Content */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 sm:px-12 py-12 bg-white relative">
        {/* Mobile brand header */}
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" strokeWidth="2.5" />
            </svg>
          </div>
          <span className="text-xl font-bold text-neutral-900">
            Aegis Platform
          </span>
        </div>

        {children}

        <p className="absolute bottom-6 text-xs text-neutral-400">
          &copy; {new Date().getFullYear()} Aegis Platform. All rights
          reserved.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Card Component
// ---------------------------------------------------------------------------

function ErrorCard({
  title,
  message,
  actionLabel,
  actionHref,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-rose-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 mb-6">{message}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="inline-flex px-4 py-2.5 rounded-lg bg-primary-500 text-white text-[14px] font-medium hover:bg-primary-600 transition-colors"
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
