'use client';

import * as React from 'react';

// ---------------------------------------------------------------------------
// StepChannelBinding - Coming Soon
// ---------------------------------------------------------------------------

export function StepChannelBinding() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-neutral-100 p-4 mb-4">
        <svg className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">Channel Integration</h3>
      <p className="text-sm text-neutral-500 max-w-md">
        Connect your agent to Telegram, Slack, and other channels.
        This feature requires OAuth setup and will be available in a future update.
      </p>
      <span className="mt-4 inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
        Coming Soon
      </span>
    </div>
  );
}
