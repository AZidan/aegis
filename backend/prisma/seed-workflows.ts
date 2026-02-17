/**
 * Seed built-in workflow templates.
 * Sprint 7 — S7-01
 *
 * Usage: npx ts-node prisma/seed-workflows.ts
 * Or import and call seedWorkflows(prisma) from a master seed script.
 */
import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const TEMPLATES = [
  {
    name: 'daily_sync',
    label: 'Daily Sync',
    description:
      'Single-step data request workflow for daily agent synchronization.',
    isSystem: true,
    steps: [
      {
        name: 'sync_data_request',
        type: 'data_request',
        timeoutMs: 300_000, // 5 min
        config: { subject: 'Daily sync data exchange' },
      },
    ],
  },
  {
    name: 'weekly_standup',
    label: 'Weekly Standup',
    description:
      'Three-step workflow: notify agents, collect data, then broadcast status update.',
    isSystem: true,
    steps: [
      {
        name: 'standup_notification',
        type: 'notification',
        timeoutMs: 60_000,
        config: { subject: 'Weekly standup starting' },
      },
      {
        name: 'collect_status',
        type: 'data_request',
        timeoutMs: 300_000,
        config: { subject: 'Please provide your weekly status' },
      },
      {
        name: 'broadcast_status',
        type: 'status_update',
        timeoutMs: 120_000,
        config: { subject: 'Weekly standup summary' },
      },
    ],
  },
  {
    name: 'sprint_handoff',
    label: 'Sprint Handoff',
    description:
      'Two-step workflow: hand off tasks between agents, then confirm with data request.',
    isSystem: true,
    steps: [
      {
        name: 'task_handoff',
        type: 'task_handoff',
        timeoutMs: 300_000,
        config: { subject: 'Sprint task handoff' },
      },
      {
        name: 'handoff_confirmation',
        type: 'data_request',
        timeoutMs: 300_000,
        config: { subject: 'Confirm handoff receipt' },
      },
    ],
  },
];

export async function seedWorkflows(prisma: PrismaClient) {
  for (const tpl of TEMPLATES) {
    await prisma.workflowTemplate.upsert({
      where: { name: tpl.name },
      update: {
        label: tpl.label,
        description: tpl.description,
        steps: tpl.steps,
      },
      create: {
        name: tpl.name,
        label: tpl.label,
        description: tpl.description,
        isSystem: tpl.isSystem,
        tenantId: null, // Built-in — visible to all tenants
        steps: tpl.steps,
      },
    });
  }

  console.log(`Seeded ${TEMPLATES.length} built-in workflow templates.`);
}

// Allow direct execution
if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  seedWorkflows(prisma)
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
