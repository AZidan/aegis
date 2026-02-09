import { z } from 'zod';

export const PermissionManifestSchema = z.object({
  network: z.object({
    allowedDomains: z.array(z.string()).default([]),
  }),
  files: z.object({
    readPaths: z.array(z.string()).default([]),
    writePaths: z.array(z.string()).default([]),
  }),
  env: z.object({
    required: z.array(z.string()).default([]),
    optional: z.array(z.string()).default([]),
  }),
});

export type PermissionManifestDto = z.infer<typeof PermissionManifestSchema>;

/**
 * Legacy format schema for detection/migration.
 */
export const LegacyPermissionsSchema = z.object({
  network: z.array(z.string()),
  files: z.array(z.string()),
  env: z.array(z.string()),
});
