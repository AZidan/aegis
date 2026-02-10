import { PermissionManifest } from '../types/permission-manifest';

/**
 * Fluent builder for constructing a PermissionManifest.
 *
 * Usage:
 *   const permissions = definePermissions()
 *     .allowDomains('api.example.com', '*.openai.com')
 *     .readPaths('/data/input')
 *     .writePaths('/data/output')
 *     .requireEnv('API_KEY')
 *     .optionalEnv('DEBUG')
 *     .build();
 */
export class PermissionBuilder {
  private manifest: PermissionManifest = {
    network: { allowedDomains: [] },
    files: { readPaths: [], writePaths: [] },
    env: { required: [], optional: [] },
  };

  /** Add one or more allowed network domains (supports wildcards like *.example.com) */
  allowDomains(...domains: string[]): this {
    this.manifest.network.allowedDomains.push(...domains);
    return this;
  }

  /** Add one or more read paths */
  readPaths(...paths: string[]): this {
    this.manifest.files.readPaths.push(...paths);
    return this;
  }

  /** Add one or more write paths */
  writePaths(...paths: string[]): this {
    this.manifest.files.writePaths.push(...paths);
    return this;
  }

  /** Add one or more required environment variables */
  requireEnv(...vars: string[]): this {
    this.manifest.env.required.push(...vars);
    return this;
  }

  /** Add one or more optional environment variables */
  optionalEnv(...vars: string[]): this {
    this.manifest.env.optional.push(...vars);
    return this;
  }

  /** Build and return the PermissionManifest */
  build(): PermissionManifest {
    return structuredClone(this.manifest);
  }
}

/**
 * Start building a PermissionManifest with the fluent builder.
 */
export function definePermissions(): PermissionBuilder {
  return new PermissionBuilder();
}
