import { z } from 'zod';

const fileRuleSchema = z.object({
  required: z.boolean().optional(),
  type: z.string().optional(),
  maxSizeKb: z.number().optional(),
  sandbox: z.boolean().optional(),
  allowedExtensions: z.array(z.string()).optional(),
});

export const manifestSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g. 1.0.0)'),
  description: z.string().min(10).max(500),
  category: z.enum([
    'productivity',
    'analytics',
    'engineering',
    'communication',
    'security',
    'integration',
    'custom',
  ]),
  author: z.string().min(1).max(200),
  runtime: z.enum(['markdown', 'javascript', 'typescript']),
  compatibleRoles: z.array(z.string()).min(1),
  permissions: z.object({
    network: z
      .object({
        allowedDomains: z.array(z.string()).default([]),
      })
      .optional()
      .default({ allowedDomains: [] }),
    files: z
      .object({
        readPaths: z.array(z.string()).default([]),
        writePaths: z.array(z.string()).default([]),
      })
      .optional()
      .default({ readPaths: [], writePaths: [] }),
    env: z
      .object({
        required: z.array(z.string()).default([]),
        optional: z.array(z.string()).default([]),
      })
      .optional()
      .default({ required: [], optional: [] }),
  }),
  config: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'select']),
        required: z.boolean(),
        options: z.array(z.union([z.string(), z.number()])).optional(),
        defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
      }),
    )
    .optional()
    .default([]),
  validation: z
    .object({
      strict: z.boolean().optional().default(false),
      fileRules: z
        .record(z.string(), fileRuleSchema)
        .optional()
        .default({}),
    })
    .optional()
    .default({ strict: false, fileRules: {} }),
});

export type ManifestDto = z.infer<typeof manifestSchema>;
