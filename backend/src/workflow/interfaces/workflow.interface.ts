/**
 * Workflow Interfaces
 * Sprint 7 — S7-01
 */

export interface WorkflowStep {
  name: string;
  type: 'notification' | 'data_request' | 'status_update' | 'task_handoff';
  agentRole?: string; // Optional: resolve agent by role instead of explicit ID
  timeoutMs?: number;
  config?: Record<string, unknown>;
}

export interface StepLog {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timed_out';
  startedAt: string;
  completedAt?: string;
  error?: string;
  messageId?: string;
}

export interface ExecuteStepJob {
  instanceId: string;
  stepIndex: number;
}

export interface TimeoutStepJob {
  instanceId: string;
  stepIndex: number;
}
