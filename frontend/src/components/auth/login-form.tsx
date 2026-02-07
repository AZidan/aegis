'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';
import { login as loginApi, adminLogin as adminLoginApi, adminVerifyMfa } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { ROUTES } from '@/lib/constants';
import { PasswordInput } from './password-input';
import { OAuthButtons } from './oauth-buttons';
import type { User } from '@/types/auth';

interface LoginFormProps {
  variant: 'admin' | 'tenant';
}

/**
 * Login form component with admin/tenant variants
 * Admin: email+password only, inline MFA, calls /admin/auth/login, redirects to /admin
 * Tenant: email+password + OAuth, forgot password, redirects to /mfa-verify for MFA, calls /auth/login
 */
export function LoginForm({ variant }: LoginFormProps) {
  const router = useRouter();
  const authStore = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mfaState, setMfaState] = useState<{ required: boolean; email: string }>({
    required: false,
    email: '',
  });
  const [mfaCode, setMfaCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);
  const mfaInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Auto-submit MFA code when all 6 digits are entered (admin inline MFA only)
  const submitMfaCode = async (fullCode: string) => {
    if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) return;
    if (isMfaSubmitting) return;
    setIsMfaSubmitting(true);
    setServerError(null);
    try {
      const response = await adminVerifyMfa({
        email: mfaState.email,
        totpCode: fullCode,
      });
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role,
        tenantId: response.user.tenantId,
        createdAt: new Date().toISOString(),
      };
      authStore.login(user, response.accessToken, response.refreshToken);
      router.push(ROUTES.ADMIN_HOME);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string } };
      };
      setServerError(
        axiosError.response?.data?.message || 'Invalid code. Please try again.'
      );
      setMfaCode(['', '', '', '', '', '']);
      mfaInputRefs.current[0]?.focus();
    } finally {
      setIsMfaSubmitting(false);
    }
  };

  const handleMfaChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...mfaCode];
    newCode[index] = value;
    setMfaCode(newCode);
    if (value && index < 5) {
      mfaInputRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all 6 digits are filled
    const fullCode = newCode.join('');
    if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) {
      submitMfaCode(fullCode);
    }
  };

  const handleMfaKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!mfaCode[index] && index > 0) {
        const newCode = [...mfaCode];
        newCode[index - 1] = '';
        setMfaCode(newCode);
        mfaInputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      mfaInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      mfaInputRefs.current[index + 1]?.focus();
    }
  };

  const handleMfaPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      setMfaCode(pasted.split(''));
      mfaInputRefs.current[5]?.focus();
      submitMfaCode(pasted);
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    try {
      const loginFn = variant === 'admin' ? adminLoginApi : loginApi;
      const response = await loginFn({
        email: data.email,
        password: data.password,
      });

      // If MFA is required
      if (response.mfaRequired && response.email) {
        if (variant === 'admin') {
          // Admin: show inline MFA input
          setMfaState({ required: true, email: response.email });
          // Focus first MFA input after render
          setTimeout(() => mfaInputRefs.current[0]?.focus(), 100);
          return;
        } else {
          // Tenant: redirect to /mfa-verify page
          sessionStorage.setItem('mfa_email', response.email);
          router.push(ROUTES.MFA_VERIFY);
          return;
        }
      }

      // Login successful - store user and tokens
      if (response.user && response.accessToken) {
        const user: User = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: response.user.role,
          tenantId: response.user.tenantId,
          createdAt: new Date().toISOString(),
        };

        authStore.login(user, response.accessToken, response.refreshToken);

        // Redirect based on variant
        if (variant === 'admin') {
          router.push(ROUTES.ADMIN_HOME);
        } else {
          router.push(ROUTES.DASHBOARD);
        }
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string; error?: { message?: string } } } };

      if (axiosError.response?.status === 401) {
        setServerError('Invalid email or password. Please try again.');
      } else if (axiosError.response?.status === 403) {
        setServerError('Access denied. This login is restricted to platform administrators.');
      } else if (axiosError.response?.status === 423) {
        setServerError('Your account has been locked. Please contact support.');
      } else if (axiosError.response?.status === 429) {
        setServerError('Too many login attempts. Please try again later.');
      } else if (axiosError.response?.data?.message) {
        setServerError(axiosError.response.data.message);
      } else if (axiosError.response?.data?.error?.message) {
        setServerError(axiosError.response.data.error.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  // Admin inline MFA view
  if (variant === 'admin' && mfaState.required) {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter the 6-digit code from your authenticator app for{' '}
            <strong className="text-slate-700 dark:text-slate-300">{mfaState.email}</strong>
          </p>
        </div>

        {serverError && (
          <div
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-400">{serverError}</p>
          </div>
        )}

        <div className="flex justify-center gap-2" onPaste={handleMfaPaste}>
          {mfaCode.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                mfaInputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleMfaChange(index, e.target.value)}
              onKeyDown={(e) => handleMfaKeyDown(index, e)}
              disabled={isMfaSubmitting}
              className={cn(
                'h-14 w-12 rounded-lg border text-center text-xl font-semibold',
                'bg-white dark:bg-slate-800',
                'text-slate-900 dark:text-white',
                'transition-all duration-150',
                'border-slate-300 dark:border-slate-600',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label={`Digit ${index + 1} of 6`}
            />
          ))}
        </div>

        {isMfaSubmitting && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying code...
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Server error banner */}
      {serverError && (
        <div
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{serverError}</p>
        </div>
      )}

      {/* OAuth buttons - tenant only */}
      {variant === 'tenant' && (
        <>
          <OAuthButtons mode="login" disabled={isSubmitting} />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                Or continue with email
              </span>
            </div>
          </div>
        </>
      )}

      {/* Login form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register('email')}
            className={cn(
              'block w-full rounded-lg border px-4 py-2.5 text-sm',
              'bg-white dark:bg-slate-800',
              'text-slate-900 dark:text-white',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'transition-colors duration-150',
              errors.email
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20',
              'focus:outline-none focus:ring-2'
            )}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-red-500" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password field */}
        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Forgot password - tenant only */}
        {variant === 'tenant' && (
          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'bg-blue-600 text-white font-medium text-sm',
            'hover:bg-blue-700 active:bg-blue-800',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </div>
  );
}
