'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import type { AgentRole, RoleConfig } from '@/lib/api/agents';
import { FALLBACK_ROLE_COLOR } from '@/lib/api/agents';
import { useRoles } from '@/lib/hooks/use-agents';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4',
];

interface StepBasicInfoProps {
  name: string;
  onNameChange: (v: string) => void;
  role: AgentRole | '';
  onRoleChange: (v: AgentRole) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  avatarColor: string;
  onAvatarColorChange: (v: string) => void;
}

export function StepBasicInfo({
  name,
  onNameChange,
  role,
  onRoleChange,
  description,
  onDescriptionChange,
  avatarColor,
  onAvatarColorChange,
}: StepBasicInfoProps) {
  const { data: roles, isLoading: rolesLoading } = useRoles();

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 mb-1">
        Basic Information
      </h2>
      <p className="text-sm text-neutral-500 mb-6">
        Set up the agent identity and role.
      </p>

      <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-6">
        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-1.5">
            Agent Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Nadia, Atlas, Iris"
            className="w-full h-10 px-3 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            placeholder="What will this agent help with?"
            className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-colors resize-none"
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-3">
            Role
          </label>
          {rolesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-[120px] rounded-xl border-2 border-neutral-200 bg-neutral-50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(roles ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onRoleChange(r.name)}
                  className={cn(
                    'text-left rounded-xl border-2 p-4 transition-all hover:shadow-md cursor-pointer',
                    role === r.name
                      ? 'border-primary-500 bg-primary-50/50 shadow-sm'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  )}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-white text-sm font-bold"
                    style={{ backgroundColor: r.color || '#737373' }}
                  >
                    {r.label.charAt(0)}
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-900 mb-0.5">
                    {r.label}
                  </h4>
                  <p className="text-xs text-neutral-500">{r.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Avatar Color */}
        <div>
          <label className="block text-sm font-medium text-neutral-900 mb-3">
            Avatar Color
          </label>
          <div className="flex items-center gap-3 flex-wrap">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onAvatarColorChange(color)}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold transition-all',
                  avatarColor === color && 'ring-[3px] ring-primary-500 ring-offset-2'
                )}
                style={{ backgroundColor: color }}
              >
                {name ? name.charAt(0).toUpperCase() : '?'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
