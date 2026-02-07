'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ShieldCheck, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { verifyMfa } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { ROUTES } from '@/lib/constants';
import type { User } from '@/types/auth';

/**
 * MFA Verification form component
 * 6-digit code input with auto-submit on completion
 */
export function MfaVerifyForm() {
  const router = useRouter();
  const authStore = useAuthStore();
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showBackupInput, setShowBackupInput] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const email =
    typeof window !== 'undefined' ? sessionStorage.getItem('mfa_email') || '' : '';

  const submitCode = useCallback(
    async (fullCode: string) => {
      if (fullCode.length !== 6 || !/^\d{6}$/.test(fullCode)) return;
      setIsSubmitting(true);
      setServerError(null);
      try {
        const response = await verifyMfa({ email, totpCode: fullCode });
        const user: User = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          role: response.user.role,
          tenantId: response.user.tenantId,
          createdAt: new Date().toISOString(),
        };
        authStore.login(user, response.accessToken, response.refreshToken);
        sessionStorage.removeItem('mfa_email');
        if (user.role === 'platform_admin') {
          router.push(ROUTES.ADMIN_DASHBOARD);
        } else {
          router.push(ROUTES.DASHBOARD);
        }
      } catch (error: unknown) {
        const axiosError = error as {
          response?: { data?: { error?: { message?: string } } };
        };
        setServerError(
          axiosError.response?.data?.error?.message || 'Invalid code. Please try again.'
        );
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, authStore, router]
  );

  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === 6) {
      submitCode(fullCode);
    }
  }, [code, submitCode]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCode.trim()) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await verifyMfa({ email, totpCode: backupCode.trim() });
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role,
        tenantId: response.user.tenantId,
        createdAt: new Date().toISOString(),
      };
      authStore.login(user, response.accessToken, response.refreshToken);
      sessionStorage.removeItem('mfa_email');
      if (user.role === 'platform_admin') {
        router.push(ROUTES.ADMIN_DASHBOARD);
      } else {
        router.push(ROUTES.DASHBOARD);
      }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      setServerError(
        axiosError.response?.data?.error?.message || 'Invalid backup code. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header info */}
      <div className="flex flex-col items-center space-y-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {email ? (
            <>
              Enter the 6-digit code from your authenticator app for{' '}
              <strong className="text-slate-700 dark:text-slate-300">{email}</strong>
            </>
          ) : (
            'Enter the 6-digit code from your authenticator app'
          )}
        </p>
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

      {!showBackupInput ? (
        <>
          {/* 6-digit code input */}
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={isSubmitting}
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

          {/* Loading during auto-submit */}
          {isSubmitting && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying code...
            </div>
          )}

          {/* Backup code link */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowBackupInput(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              Use a backup code instead
            </button>
          </div>
        </>
      ) : (
        /* Backup code form */
        <form onSubmit={handleBackupSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="backupCode"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Backup code
            </label>
            <input
              id="backupCode"
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              placeholder="Enter your backup code"
              disabled={isSubmitting}
              className={cn(
                'block w-full rounded-lg border px-4 py-2.5 text-sm font-mono',
                'bg-white dark:bg-slate-800',
                'text-slate-900 dark:text-white',
                'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                'border-slate-300 dark:border-slate-600',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
                'transition-colors duration-150'
              )}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !backupCode.trim()}
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
              'Verify backup code'
            )}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setShowBackupInput(false);
                setServerError(null);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              Back to code input
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
