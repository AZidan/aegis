'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Copy, Check, Shield } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { mfaVerifySchema, type MfaVerifyFormData } from '@/lib/validations/auth';
import { setupMfa, verifyMfa } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { ROUTES } from '@/lib/constants';

/**
 * MFA Setup form component
 * Displays QR code for TOTP app setup and verifies initial code
 */
export function MfaSetupForm() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [isSettingUp, setIsSettingUp] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaVerifyFormData>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: {
      code: '',
    },
  });

  // Fetch MFA setup data on mount
  useEffect(() => {
    async function initSetup() {
      try {
        const response = await setupMfa();
        setQrCode(response.qrCode);
        setSecret(response.secret);
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { error?: { message?: string } } };
        };
        setSetupError(
          axiosError.response?.data?.error?.message ||
            'Failed to initialize MFA setup. Please try again.'
        );
      } finally {
        setIsSettingUp(false);
      }
    }

    initSetup();
  }, []);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = secret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    }
  };

  const onSubmit = async (data: MfaVerifyFormData) => {
    setServerError(null);

    try {
      await verifyMfa({
        email: user?.email || '',
        totpCode: data.code,
      });

      setIsVerified(true);

      // Redirect to dashboard after a brief success animation
      setTimeout(() => {
        router.push(ROUTES.DASHBOARD);
      }, 2000);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      setServerError(
        axiosError.response?.data?.error?.message || 'Invalid verification code. Please try again.'
      );
    }
  };

  // Loading state while fetching QR code
  if (isSettingUp) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Setting up MFA...</p>
      </div>
    );
  }

  // Setup error state
  if (setupError) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{setupError}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'bg-blue-600 text-white font-medium text-sm',
            'hover:bg-blue-700 transition-colors duration-150'
          )}
        >
          Try again
        </button>
      </div>
    );
  }

  // Success state
  if (isVerified) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            MFA Enabled Successfully
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Instructions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Scan with your authenticator app
          </p>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Use an app like Google Authenticator, Authy, or 1Password to scan the QR code below.
        </p>
      </div>

      {/* QR Code display */}
      <div className="flex justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          {qrCode ? (
            <img
              src={qrCode}
              alt="MFA QR Code - scan with your authenticator app"
              className="h-48 w-48"
              width={192}
              height={192}
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      </div>

      {/* Manual secret key */}
      <div className="space-y-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Or enter this code manually in your authenticator app:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white break-all">
            {secret}
          </code>
          <button
            type="button"
            onClick={handleCopySecret}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-2',
              'border-slate-200 dark:border-slate-700',
              'hover:bg-slate-50 dark:hover:bg-slate-800',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20'
            )}
            aria-label="Copy secret key"
          >
            {secretCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Server error */}
      {serverError && (
        <div
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{serverError}</p>
        </div>
      )}

      {/* Verification form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="code"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Enter verification code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            {...register('code')}
            className={cn(
              'block w-full rounded-lg border px-4 py-3 text-center text-lg font-mono tracking-[0.5em]',
              'bg-white dark:bg-slate-800',
              'text-slate-900 dark:text-white',
              'placeholder:text-slate-300 dark:placeholder:text-slate-600',
              'transition-colors duration-150',
              errors.code
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-500/20',
              'focus:outline-none focus:ring-2'
            )}
            aria-invalid={errors.code ? 'true' : 'false'}
            aria-describedby={errors.code ? 'code-error' : undefined}
          />
          {errors.code && (
            <p id="code-error" className="text-sm text-red-500 text-center" role="alert">
              {errors.code.message}
            </p>
          )}
        </div>

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
              Verifying...
            </>
          ) : (
            'Verify and enable MFA'
          )}
        </button>
      </form>
    </div>
  );
}
