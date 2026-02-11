import { z } from 'zod';

// ---------------------------------------------------------------------------
// PUT /api/admin/role-configs/:id  -  Update role config templates & metadata
// ---------------------------------------------------------------------------
export const updateRoleConfigSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  defaultToolCategories: z.array(z.string()).optional(),
  soulTemplate: z.string().optional(),
  agentsTemplate: z.string().optional(),
  heartbeatTemplate: z.string().optional(),
  userTemplate: z.string().optional(),
  identityEmoji: z.string().max(50).optional(),
  openclawConfigTemplate: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateRoleConfigDto = z.infer<typeof updateRoleConfigSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/role-configs/:id/preview  -  Render a template with sample data
// ---------------------------------------------------------------------------
export const previewTemplateSchema = z.object({
  templateField: z.enum([
    'soulTemplate',
    'agentsTemplate',
    'heartbeatTemplate',
    'userTemplate',
  ]),
  sampleData: z.record(z.string(), z.string()).optional(),
});

export type PreviewTemplateDto = z.infer<typeof previewTemplateSchema>;
