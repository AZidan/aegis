'use client';

import type { AuditLogEntry } from '@/lib/api/audit';

interface AuditLogDetailProps {
  entry: AuditLogEntry;
}

export function AuditLogDetail({ entry }: AuditLogDetailProps) {
  const metadata: Record<string, unknown> = {
    event_type: entry.action,
    actor_type: entry.actorType,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    target_type: entry.targetType,
    target_id: entry.targetId,
    severity: entry.severity,
    ...(entry.ipAddress ? { ip_address: entry.ipAddress } : {}),
    ...(entry.userAgent ? { user_agent: entry.userAgent } : {}),
    ...(entry.tenantId ? { tenant_id: entry.tenantId } : {}),
    ...(entry.userId ? { user_id: entry.userId } : {}),
    ...(entry.agentId ? { agent_id: entry.agentId } : {}),
    ...(entry.details ?? {}),
  };

  return (
    <div className="border-t border-neutral-100 bg-neutral-50/70 px-12 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Action Metadata
        </span>
        <span className="font-mono text-[10px] text-neutral-400">
          event_id: {entry.id.slice(0, 12)}
        </span>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-primary-950 p-4 font-mono text-xs leading-relaxed text-primary-200">
        <code>{JSON.stringify(metadata, null, 2)}</code>
      </pre>
    </div>
  );
}
