/**
 * Auto-mock for @kubernetes/client-node (pure ESM package).
 * Jest cannot transform this package from ESM to CJS, so we provide
 * a lightweight CJS-compatible mock. Individual test files that need
 * to control k8s behaviour can override with jest.mock().
 */

export class KubeConfig {
  loadFromDefault = jest.fn();
  setCurrentContext = jest.fn();
  makeApiClient = jest.fn().mockReturnValue({});
}

export class AppsV1Api {}
export class CoreV1Api {}
export class NetworkingV1Api {}

// Re-export commonly referenced types as empty objects
export const V1Deployment = {};
export const V1Service = {};
export const V1ConfigMap = {};
export const V1Secret = {};
export const V1NetworkPolicy = {};
export const V1Pod = {};
