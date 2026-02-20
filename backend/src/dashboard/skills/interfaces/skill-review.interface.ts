/**
 * Skill Review Interfaces
 *
 * Types for the LLM-based skill review pipeline (Sprint 10 - S10-02).
 */

export interface ReviewFinding {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

export interface SkillReviewResult {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: ReviewFinding[];
  summary: string;
  reviewedAt: string; // ISO 8601
}

export interface ReviewJobPayload {
  skillId: string;
  tenantId: string | null;
  skillName: string;
  skillVersion: string;
  sourceCode: string;
  documentation: string | null;
  permissions: Record<string, unknown>;
  compatibleRoles: string[];
}

export function riskScoreToLevel(
  score: number,
): SkillReviewResult['riskLevel'] {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}
