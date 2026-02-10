/**
 * Permission Manifest types for Aegis Skill SDK.
 * Mirrors backend/src/dashboard/skills/interfaces/permission-manifest.interface.ts
 */

/** Structured permission manifest (v2 format) */
export interface PermissionManifest {
  network: { allowedDomains: string[] };
  files: { readPaths: string[]; writePaths: string[] };
  env: { required: string[]; optional: string[] };
}
