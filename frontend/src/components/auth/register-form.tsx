'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  registerSchema,
  type RegisterFormData,
  calculatePasswordStrength,
} from '@/lib/validations/auth';
import { register as registerApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { ROUTES } from '@/lib/constants';
import { PasswordInput } from './password-input';
import { OAuthButtons } from './oauth-buttons';
import type { User } from '@/types/auth';

/**
 * Register form component
 * Full registration flow with password strength indicator
 */
export function RegisterForm() {
  const router = useRouter();
  const authStore = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const passwordValue = watch('password', '');
  const strength = calculatePasswordStrength(passwordValue);

  // Individual requirement checks for display
  const passwordRequirements = [
    { label: 'At least 8 characters', met: passwordValue.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(passwordValue) },
    { label: 'One lowercase letter', met: /[a-z]/.test(passwordValue) },
    { label: 'One number', met: /[0-9]/.test(passwordValue) },
    {
      label: 'One special character',
      met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(passwordValue),
    },
  ];

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);

    try {
      const response = await registerApi({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      // Registration successful - store user and tokens
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role,
        tenantId: response.user.tenantId,
        createdAt: response.user.createdAt,
      };

      authStore.login(user, response.accessToken, response.refreshToken);
      router.push(ROUTES.DASHBOARD);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: { error?: { message?: string; code?: string } } };
      };

      if (axiosError.response?.status === 409) {
        setServerError('An account with this email already exists. Please sign in instead.');
      } else if (axiosError.response?.data?.error?.message) {
        setServerError(axiosError.response.data.error.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

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

      {/* OAuth buttons */}
      <OAuthButtons mode="register" disabled={isSubmitting} />

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-200 dark:border-slate-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            Or register with email
          </span>
        </div>
      </div>

      {/* Register form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Name field */}
        <div className="space-y-1.5">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="John Doe"
            {...register('name')}
            className={cn(
              'block w-full rounded-lg border px-4 py-2.5 text-sm',
              'bg-white dark:bg-slate-800',
              'text-slate-900 dark:text-white',
              'placeholder:text-slate-400 dark:placeholder:text-slate-500',
              'transition-colors duration-150',
              errors.name
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20',
              'focus:outline-none focus:ring-2'
            )}
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-sm text-red-500" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

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
        <div className="space-y-2">
          <PasswordInput
            id="password"
            label="Password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            error={errors.password?.message}
            {...register('password')}
          />

          {/* Password strength indicator */}
          {passwordValue && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors duration-300',
                        index < strength.score
                          ? strength.color
                          : 'bg-slate-200 dark:bg-slate-700'
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {strength.label}
                </span>
              </div>

              {/* Password requirements checklist */}
              <ul className="space-y-1">
                {passwordRequirements.map((req) => (
                  <li key={req.label} className="flex items-center gap-2 text-xs">
                    {req.met ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    )}
                    <span
                      className={cn(
                        req.met
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {req.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Confirm password field */}
        <PasswordInput
          id="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Confirm your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Terms of service checkbox */}
        <div className="space-y-1.5">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('acceptTerms')}
              className={cn(
                'mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600',
                'text-blue-600 focus:ring-blue-500/20',
                'bg-white dark:bg-slate-800'
              )}
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              I agree to the{' '}
              <Link
                href="/terms"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                target="_blank"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                target="_blank"
              >
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="text-sm text-red-500" role="alert">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

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
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
