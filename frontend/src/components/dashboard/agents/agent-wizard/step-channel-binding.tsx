'use client';

import * as React from 'react';
import {
  MessageSquare,
  ExternalLink,
  Check,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { fetchSlackInstallUrl } from '@/lib/api/agents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChannelBindingState {
  slackConnected: boolean;
  slackWorkspaceName?: string;
}

interface StepChannelBindingProps {
  channels: ChannelBindingState;
  onChannelsChange: (channels: ChannelBindingState) => void;
}

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

const PLATFORMS = [
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    available: true,
    description:
      'Connect your Slack workspace to route messages to this agent.',
    color: 'bg-[#4A154B]',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: MessageSquare,
    available: false,
    description: 'Connect Teams channels for enterprise collaboration.',
    color: 'bg-[#464EB8]',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: MessageSquare,
    available: false,
    description: 'Connect Discord servers for community management.',
    color: 'bg-[#5865F2]',
  },
];

// ---------------------------------------------------------------------------
// StepChannelBinding
// ---------------------------------------------------------------------------

export function StepChannelBinding({
  channels,
  onChannelsChange,
}: StepChannelBindingProps) {
  const [connecting, setConnecting] = React.useState(false);

  const handleSlackConnect = async () => {
    setConnecting(true);
    try {
      // Fetch the Slack OAuth URL via authenticated API call
      const { url } = await fetchSlackInstallUrl();

      // Open the Slack OAuth URL directly in a popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        url,
        'slack-oauth',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      // Listen for postMessage from callback page
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'slack-oauth-success') {
          onChannelsChange({
            slackConnected: true,
            slackWorkspaceName:
              event.data.workspaceName || 'Connected Workspace',
          });
          setConnecting(false);
          window.removeEventListener('message', handler);
        } else if (event.data?.type === 'slack-oauth-error') {
          setConnecting(false);
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);

      // Fallback: timeout after 2 minutes
      setTimeout(() => {
        setConnecting(false);
        window.removeEventListener('message', handler);
      }, 120_000);
    } catch {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">
          Channel Integration
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Connect your agent to communication platforms. You can also configure
          channels later from the agent detail page.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => {
          const isConnected =
            platform.id === 'slack' && channels.slackConnected;
          const Icon = platform.icon;

          return (
            <div
              key={platform.id}
              className={cn(
                'relative rounded-xl border p-5 transition-all',
                isConnected
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : platform.available
                    ? 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'
                    : 'border-neutral-100 bg-neutral-50/50 opacity-60'
              )}
            >
              {/* Platform header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-lg text-white',
                    platform.color
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {platform.name}
                  </h3>
                  {!platform.available && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <Clock className="h-3 w-3" /> Coming Soon
                    </span>
                  )}
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <Check className="h-3 w-3" /> Connected
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-neutral-500 mb-4">
                {platform.description}
              </p>

              {/* Connected state */}
              {isConnected && (
                <div className="text-xs text-neutral-600 bg-white rounded-lg p-2.5 border border-emerald-100 mb-3">
                  Workspace:{' '}
                  <span className="font-medium">
                    {channels.slackWorkspaceName}
                  </span>
                </div>
              )}

              {/* Action button */}
              {platform.available && !isConnected && (
                <button
                  onClick={
                    platform.id === 'slack' ? handleSlackConnect : undefined
                  }
                  disabled={connecting}
                  className={cn(
                    'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    connecting
                      ? 'bg-neutral-100 text-neutral-400 cursor-wait'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  )}
                >
                  {connecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-300 border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Connect
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
        <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700">
          Channel binding is optional during agent creation. You can configure
          channels later from the agent detail page under the Channels tab.
        </p>
      </div>
    </div>
  );
}
