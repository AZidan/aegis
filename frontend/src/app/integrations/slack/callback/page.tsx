'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, AlertCircle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams, must be wrapped in Suspense)
// ---------------------------------------------------------------------------

function SlackCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>(
    'loading'
  );

  React.useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      window.opener?.postMessage({ type: 'slack-oauth-error', error }, '*');
      setTimeout(() => window.close(), 3000);
      return;
    }

    if (code) {
      // The backend handles the OAuth exchange via the install route redirect
      setStatus('success');
      window.opener?.postMessage(
        {
          type: 'slack-oauth-success',
          workspaceName: searchParams.get('team_name') || 'Slack Workspace',
        },
        '*'
      );
      setTimeout(() => window.close(), 2000);
    }
  }, [searchParams]);

  return (
    <div className="text-center p-8">
      {status === 'loading' && (
        <>
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-neutral-600">Connecting to Slack...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-emerald-600" />
          </div>
          <p className="text-sm font-medium text-neutral-900">
            Slack Connected!
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            This window will close automatically.
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <p className="text-sm font-medium text-neutral-900">
            Connection Failed
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            This window will close automatically.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slack OAuth Callback Page
// ---------------------------------------------------------------------------

export default function SlackCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <Suspense
        fallback={
          <div className="text-center p-8">
            <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-neutral-600">Loading...</p>
          </div>
        }
      >
        <SlackCallbackContent />
      </Suspense>
    </div>
  );
}
