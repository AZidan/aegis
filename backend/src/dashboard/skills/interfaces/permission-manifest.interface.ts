/**
 * New structured permission manifest (v2).
 * Replaces flat array format with typed nested objects.
 */
export interface PermissionManifest {
  network: { allowedDomains: string[] };
  files: { readPaths: string[]; writePaths: string[] };
  env: { required: string[]; optional: string[] };
}

/**
 * Legacy permission format (v1).
 */
export interface LegacyPermissions {
  network: string[];
  files: string[];
  env: string[];
}

/**
 * Diff between two permission manifests.
 */
export interface PermissionDiff {
  added: Partial<PermissionManifest>;
  removed: Partial<PermissionManifest>;
  unchanged: Partial<PermissionManifest>;
}

/**
 * A recorded permission violation.
 */
export interface PermissionViolation {
  skillId: string;
  agentId: string;
  violationType: 'network' | 'files' | 'env';
  detail: string;
  timestamp: Date;
}
