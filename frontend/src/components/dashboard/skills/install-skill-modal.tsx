'use client';

import * as React from 'react';
import { Loader2, Shield, Globe, FolderOpen, Key, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAgents } from '@/lib/hooks/use-agents';
import { useInstallSkill } from '@/lib/hooks/use-skills';
import type { SkillDetail } from '@/lib/api/skills';
import { flattenPermissions } from '@/lib/api/skills';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InstallSkillModalProps {
  skill: SkillDetail;
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}

// ---------------------------------------------------------------------------
// Install Skill Modal
// ---------------------------------------------------------------------------

export function InstallSkillModal({
  skill,
  open,
  onClose,
  onInstalled,
}: InstallSkillModalProps) {
  const [selectedAgentId, setSelectedAgentId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [permissionsAccepted, setPermissionsAccepted] = React.useState(false);

  const { data: agents = [], isLoading: agentsLoading } = useAgents();
  const installMutation = useInstallSkill();

  const flat = flattenPermissions(skill.permissions);
  const hasPermissions =
    flat.network.length > 0 ||
    flat.files.length > 0 ||
    flat.env.length > 0;

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setSelectedAgentId('');
      setError(null);
      setSuccess(false);
      setPermissionsAccepted(false);
    }
  }, [open]);

  const handleInstall = () => {
    if (!selectedAgentId) {
      setError('Please select an agent.');
      return;
    }

    setError(null);
    installMutation.mutate(
      {
        skillId: skill.id,
        payload: {
          agentId: selectedAgentId,
          acceptPermissions: hasPermissions ? permissionsAccepted : undefined,
        },
      },
      {
        onSuccess: () => {
          setSuccess(true);
          setTimeout(() => {
            onInstalled();
            onClose();
          }, 1500);
        },
        onError: (err: unknown) => {
          const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          const errMsg = axiosMsg || (err instanceof Error ? err.message : 'Failed to install skill.');
          setError(errMsg);
        },
      }
    );
  };

  const canInstall =
    !!selectedAgentId &&
    !installMutation.isPending &&
    !success &&
    (!hasPermissions || permissionsAccepted);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install {skill.name}</DialogTitle>
          <DialogDescription>
            Select an agent to install this skill on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Agent selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Target Agent
            </label>
            {agentsLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents...
              </div>
            ) : (
              <select
                value={selectedAgentId}
                onChange={(e) => {
                  setSelectedAgentId(e.target.value);
                  setError(null);
                }}
                className="w-full h-9 px-3 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="">Select an agent...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Permissions review + acceptance */}
          {hasPermissions && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Permissions Required
                </span>
              </div>

              <div className="space-y-2.5 mb-4">
                {flat.network.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Globe className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-neutral-600">
                        Network Access
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {flat.network.join(', ')}
                      </p>
                    </div>
                  </div>
                )}
                {flat.files.length > 0 && (
                  <div className="flex items-start gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-neutral-600">
                        File Access
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {flat.files.join(', ')}
                      </p>
                    </div>
                  </div>
                )}
                {flat.env.length > 0 && (
                  <div className="flex items-start gap-2">
                    <Key className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-neutral-600">
                        Environment Variables
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        {flat.env.join(', ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Acceptance checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={permissionsAccepted}
                  onChange={(e) => setPermissionsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs text-neutral-600 group-hover:text-neutral-800 leading-relaxed">
                  I understand and accept that this skill will be granted the
                  above permissions on the selected agent.
                </span>
              </label>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <Shield className="h-4 w-4 text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700">
                Skill is being installed. This may take a moment.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={installMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleInstall}
            disabled={!canInstall}
          >
            {installMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              'Install Skill'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
