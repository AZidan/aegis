/**
 * Network policy types derived from installed skills' permission manifests.
 */

/** A single network policy rule */
export interface PolicyRule {
  /** Allowed domain (exact or wildcard like *.example.com) */
  domain: string;
  /** Skill ID that grants this domain access */
  skillId: string;
  /** Skill name for display */
  skillName: string;
}

/** Aggregated network policy for a tenant */
export interface NetworkPolicy {
  tenantId: string;
  /** All allowed domains aggregated from installed skills */
  rules: PolicyRule[];
  /** Unique allowed domains (deduplicated) */
  allowedDomains: string[];
  /** When this policy was generated */
  generatedAt: Date;
}

/** A network policy violation event */
export interface PolicyViolationEvent {
  tenantId: string;
  agentId: string;
  requestedDomain: string;
  /** Whether the domain was allowed */
  allowed: boolean;
  /** Matching rule if allowed, null if blocked */
  matchedRule: PolicyRule | null;
  timestamp: Date;
}
