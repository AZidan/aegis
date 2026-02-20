import { ValidationReport } from './validation-report.interface';

export interface SkillMdParsed {
  title: string;
  description: string;
  trigger?: string;
  steps: string[];
  rawContent: string;
  frontmatter: Record<string, unknown>;
}

export interface PackageFileInfo {
  path: string;
  size: number;
  type: 'skill-definition' | 'manifest' | 'javascript' | 'handlebars' | 'reference' | 'data';
}

export interface PackageValidationResult {
  valid: boolean;
  packageId?: string;
  packagePath?: string;
  manifest: Record<string, unknown> | null;
  skillMd: SkillMdParsed | null;
  files: PackageFileInfo[];
  issues: PackageValidationIssue[];
  scriptAnalysis?: ValidationReport[];
}

export interface PackageValidationIssue {
  severity: 'error' | 'warning' | 'info';
  file?: string;
  message: string;
}

export interface StoredPackage {
  packageId: string;
  packagePath: string;
  manifest: Record<string, unknown>;
  skillMd: SkillMdParsed;
  files: PackageFileInfo[];
  validationResult: PackageValidationResult;
  createdAt: Date;
  tenantId: string;
  userId: string;
}
