'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginOAuth } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/store/auth-store';
import { OAUTH_REDIRECT_URI, ROUTES } from '@/lib/constants';

type OAuthProvider = 'google' | 'github';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('No authorization code received from provider.');
      return;
    }

    const provider = sessionStorage.getItem('oauth_provider') as OAuthProvider | null;
    if (!provider || (provider !== 'google' && provider !== 'github')) {
      setError('Unable to determine OAuth provider. Please try again.');
      return;
    }

    // Clear stored provider
    sessionStorage.removeItem('oauth_provider');

    loginOAuth({ provider, code, redirectUri: OAUTH_REDIRECT_URI })
      .then((res) => {
        if (res.user) {
          login(
            { ...res.user, createdAt: new Date().toISOString() },
            res.accessToken,
            res.refreshToken,
          );
          router.replace(ROUTES.DASHBOARD);
        } else {
          setError('Login succeeded but no user data was returned.');
        }
      })
      .catch((err) => {
        const message =
          err?.response?.data?.message ||
          err?.message ||
          'OAuth login failed. Please try again.';
        setError(message);
      });
  }, [searchParams, login, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">Authentication Failed</h2>
          <p className="text-sm text-neutral-600 mb-6">{error}</p>
          <a
            href={ROUTES.LOGIN}
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-neutral-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            <p className="text-sm text-neutral-600">Loading...</p>
          </div>
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
