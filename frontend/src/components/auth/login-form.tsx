'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';
import { login as loginApi, adminLogin as adminLoginApi, adminVerifyMfa } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { ROUTES } from '@/lib/constants';
import { OAuthButtons } from './oauth-buttons';
import type { User } from '@/types/auth';

interface LoginFormProps {
  variant: 'admin' | 'tenant';
}

/**
 * Login form component with admin/tenant variants
 * Admin: email+password only, inline MFA with OTP grid, security warning banner
 * Tenant: email+password + OAuth, remember me, forgot password, register link
 */
export function LoginForm({ variant }: LoginFormProps) {
  const router = useRouter();
  const authStore = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaState, setMfaState] = useState<{ required: boolean; email: string }>({
    required: false,
    email: '',
  });
  const [mfaCode, setMfaCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(28);
  const [showSuccess, setShowSuccess] = useState(false);
  const [otpShake, setOtpShake] = useState(false);
  const mfaInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Start resend countdown timer
  const startResendTimer = useCallback(() => {
    setResendSeconds(28);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Auto-submit MFA code when all 6 digits are entered
  const submitMfaCode = useCallback(
    async (fullCode: string) => {
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

        // Show success state briefly before redirect
        if (variant === 'admin') {
          setShowSuccess(true);
          setTimeout(() => {
            router.push(ROUTES.ADMIN_HOME);
          }, 2000);
        } else {
          router.push(ROUTES.ADMIN_HOME);
        }
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { message?: string } };
        };
        setServerError(
          axiosError.response?.data?.message || 'Invalid code. Please try again.'
        );
        setMfaCode(['', '', '', '', '', '']);
        // Shake OTP inputs on error
        setOtpShake(true);
        setTimeout(() => setOtpShake(false), 400);
        mfaInputRefs.current[0]?.focus();
      } finally {
        setIsMfaSubmitting(false);
      }
    },
    [isMfaSubmitting, mfaState.email, authStore, router, variant]
  );

  const handleMfaChange = useCallback(
    (index: number, value: string) => {
      if (value && !/^\d$/.test(value)) return;
      const newCode = [...mfaCode];
      newCode[index] = value;
      setMfaCode(newCode);
      if (value && index < 5) {
        mfaInputRefs.current[index + 1]?.focus();
      }
      const fullCode = newCode.join('');
      if (fullCode.length === 6 && /^\d{6}$/.test(fullCode)) {
        submitMfaCode(fullCode);
      }
    },
    [mfaCode, submitMfaCode]
  );

  const handleMfaKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
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
    },
    [mfaCode]
  );

  const handleMfaPaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').trim();
      const digits = pasted.replace(/\D/g, '').slice(0, 6);
      if (digits.length > 0) {
        const newCode = ['', '', '', '', '', ''];
        digits.split('').forEach((digit, i) => {
          newCode[i] = digit;
        });
        setMfaCode(newCode);
        const focusIndex = Math.min(digits.length, 5);
        mfaInputRefs.current[focusIndex]?.focus();
        if (digits.length === 6) {
          submitMfaCode(digits);
        }
      }
    },
    [submitMfaCode]
  );

  const backToLogin = useCallback(() => {
    setMfaState({ required: false, email: '' });
    setMfaCode(['', '', '', '', '', '']);
    setServerError(null);
    setShowBackupCode(false);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  }, []);

  const handleResend = useCallback(() => {
    startResendTimer();
  }, [startResendTimer]);

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    try {
      const loginFn = variant === 'admin' ? adminLoginApi : loginApi;
      const response = await loginFn({
        email: data.email,
        password: data.password,
      });

      if (response.mfaRequired && response.email) {
        if (variant === 'admin') {
          setMfaState({ required: true, email: response.email });
          startResendTimer();
          setTimeout(() => mfaInputRefs.current[0]?.focus(), 100);
          return;
        } else {
          sessionStorage.setItem('mfa_email', response.email);
          router.push(ROUTES.MFA_VERIFY);
          return;
        }
      }

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

        if (variant === 'admin') {
          router.push(ROUTES.ADMIN_HOME);
        } else {
          router.push(ROUTES.DASHBOARD);
        }
      }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { message?: string; error?: { message?: string } } };
      };

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

  const allOtpFilled = mfaCode.every((d) => /^\d$/.test(d));

  // =====================================================================
  // ADMIN VARIANT - SUCCESS STATE
  // =====================================================================
  if (variant === 'admin' && showSuccess) {
    return (
      <div className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4 fade-in-up">
          <svg
            className="w-8 h-8 text-emerald-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">Authentication Successful</h2>
        <p className="text-sm text-neutral-500 mt-2">Redirecting to admin dashboard...</p>
        <div className="mt-4 w-full bg-neutral-100 rounded-full h-1 overflow-hidden">
          <div
            className="bg-primary-600 h-1 rounded-full"
            style={{
              animation: 'countdown-bar 2s linear forwards',
              animationDirection: 'reverse',
            }}
          />
        </div>
      </div>
    );
  }

  // =====================================================================
  // ADMIN VARIANT - MFA STATE
  // =====================================================================
  if (variant === 'admin' && mfaState.required) {
    return (
      <div>
        {/* MFA Heading */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Two-Factor Authentication
          </h2>
          <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
            Enter the 6-digit code from your
            <br />
            authenticator app
          </p>
        </div>

        {/* OTP Input Group */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (allOtpFilled) submitMfaCode(mfaCode.join(''));
          }}
          autoComplete="off"
        >
          <div
            className={cn(
              'flex items-center justify-center gap-2.5 sm:gap-3 mb-6',
              otpShake && 'shake-anim'
            )}
            onPaste={handleMfaPaste}
          >
            {mfaCode.map((digit, index) => (
              <React.Fragment key={index}>
                {/* Separator dash after 3rd digit */}
                {index === 3 && (
                  <div className="w-3 h-0.5 bg-neutral-300 rounded-full mx-0.5" aria-hidden="true" />
                )}
                <input
                  ref={(el) => {
                    mfaInputRefs.current[index] = el;
                  }}
                  id={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  pattern="[0-9]"
                  value={digit}
                  onChange={(e) => handleMfaChange(index, e.target.value)}
                  onKeyDown={(e) => handleMfaKeyDown(index, e)}
                  onFocus={(e) => e.target.select()}
                  disabled={isMfaSubmitting}
                  className={cn(
                    'otp-input w-12 h-14 sm:w-[48px] sm:h-[56px] text-center text-xl font-mono font-semibold',
                    'border-2 rounded-xl transition-all duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    digit
                      ? 'text-neutral-900 border-primary-400 bg-primary-50/50'
                      : 'text-neutral-900 border-neutral-200 bg-neutral-50/50 hover:border-neutral-300'
                  )}
                  aria-label={`Digit ${index + 1}`}
                />
              </React.Fragment>
            ))}
          </div>

          {/* MFA Error Message */}
          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-red-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span className="text-sm text-red-700 font-medium">{serverError}</span>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <button
            type="submit"
            disabled={!allOtpFilled || isMfaSubmitting}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 px-4',
              'bg-primary-600 hover:bg-primary-700 active:bg-primary-800',
              'text-white font-semibold text-sm rounded-xl',
              'shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
              'transition-all duration-150'
            )}
          >
            {isMfaSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Secondary Actions */}
        <div className="mt-5 space-y-3 text-center">
          {/* Resend Timer */}
          <div className="flex items-center justify-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {resendSeconds > 0 ? (
              <span className="text-sm text-neutral-400">
                Resend in{' '}
                <span className="font-mono font-medium text-neutral-500">{resendSeconds}s</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus:underline"
              >
                Resend code
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-neutral-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-xs text-neutral-400">or</span>
            </div>
          </div>

          {/* Backup Code Toggle */}
          <button
            type="button"
            onClick={() => setShowBackupCode(!showBackupCode)}
            className="text-sm font-medium text-neutral-500 hover:text-primary-600 focus:outline-none focus:underline transition-colors"
          >
            Use backup code instead
          </button>

          {/* Backup Code Input */}
          {showBackupCode && (
            <div className="pt-2">
              <input
                type="text"
                placeholder="Enter 8-character backup code"
                maxLength={10}
                className="admin-input-field w-full px-4 py-3 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 bg-neutral-50/50 hover:border-neutral-300 text-center font-mono font-medium tracking-widest uppercase"
              />
            </div>
          )}

          {/* Back to Login */}
          <button
            type="button"
            onClick={backToLogin}
            className="flex items-center justify-center gap-1.5 mx-auto text-sm text-neutral-400 hover:text-neutral-600 focus:outline-none focus:underline transition-colors mt-2"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // =====================================================================
  // ADMIN VARIANT - LOGIN FORM
  // =====================================================================
  if (variant === 'admin') {
    return (
      <div>
        {/* Heading */}
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            Platform Admin Login
          </h2>
          {/* Security warning banner */}
          <div className="flex items-center justify-center gap-2 mt-3 px-4 py-2 bg-amber-50 border border-amber-200/60 rounded-lg">
            <svg
              className="w-4 h-4 text-amber-600 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-xs text-amber-700 font-medium">
              Restricted access &mdash; authorized personnel only
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" noValidate>
          {/* Email */}
          <div className="mb-5">
            <label htmlFor="email" className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                placeholder="admin@company.com"
                {...register('email')}
                className={cn(
                  'admin-input-field w-full pl-11 pr-4 py-3 border rounded-xl text-sm text-neutral-900',
                  'placeholder-neutral-400 bg-neutral-50/50 hover:border-neutral-300',
                  'transition-all duration-150',
                  errors.email ? 'border-red-500' : 'border-neutral-200'
                )}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-neutral-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                {...register('password')}
                className={cn(
                  'admin-input-field w-full pl-11 pr-12 py-3 border rounded-xl text-sm text-neutral-900',
                  'placeholder-neutral-400 bg-neutral-50/50 hover:border-neutral-300',
                  'transition-all duration-150',
                  errors.password ? 'border-red-500' : 'border-neutral-200'
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Error Message */}
          {serverError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-red-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span className="text-sm text-red-700 font-medium">{serverError}</span>
              </div>
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 px-4',
              'bg-primary-600 hover:bg-primary-700 active:bg-primary-800',
              'text-white font-semibold text-sm rounded-xl',
              'shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'transition-all duration-150'
            )}
          >
            {isSubmitting ? (
              <>
                <span>Authenticating...</span>
                <Loader2 className="w-5 h-5 animate-spin" />
              </>
            ) : (
              <>
                <span>Sign in</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // =====================================================================
  // TENANT VARIANT - LOGIN FORM
  // =====================================================================
  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 mb-1">Welcome back</h2>
        <p className="text-neutral-500">Sign in to your account</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Email field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Email address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ahmed@breadfast.com"
              {...register('email')}
              className={cn(
                'tenant-input-field block w-full pl-11 pr-4 py-3 border rounded-lg text-neutral-900 text-sm',
                'placeholder:text-neutral-400 hover:border-neutral-400',
                'transition-all duration-150',
                errors.email ? 'border-red-500' : 'border-neutral-300'
              )}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>

        {/* Password field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              {...register('password')}
              className={cn(
                'tenant-input-field block w-full pl-11 pr-12 py-3 border rounded-lg text-neutral-900 text-sm',
                'placeholder:text-neutral-400 hover:border-neutral-400',
                'transition-all duration-150',
                errors.password ? 'border-red-500' : 'border-neutral-300'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-600"
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                  />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me + Forgot password row */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            />
            <span className="text-sm text-neutral-600">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            Forgot password?
          </Link>
        </div>

        {/* Error Message */}
        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-red-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-sm text-red-700 font-medium">{serverError}</span>
            </div>
          </div>
        )}

        {/* Sign in button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg',
            'text-white text-sm font-semibold',
            'shadow-sm hover:shadow-md active:scale-[0.98]',
            'focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:ring-offset-2',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'transition-all duration-150'
          )}
          style={{ backgroundColor: '#6366f1' }}
          onMouseOver={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#4f46e5';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLElement).style.backgroundColor = '#6366f1';
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-4 my-7">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          or continue with
        </span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>

      {/* OAuth buttons */}
      <OAuthButtons mode="login" disabled={isSubmitting} />

      {/* Contact sales link */}
      <p className="text-center text-sm text-neutral-500 mt-8">
        Don&apos;t have an account?
        <Link href="#" className="font-semibold text-primary-600 hover:text-primary-500 ml-1">
          Contact sales
        </Link>
      </p>
    </div>
  );
}
