import { Test, TestingModule } from '@nestjs/testing';
import { SkillValidatorService } from '../../../src/dashboard/skills/skill-validator.service';

describe('SkillValidatorService', () => {
  let service: SkillValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SkillValidatorService],
    }).compile();

    service = module.get(SkillValidatorService);
  });

  describe('validate — static analysis', () => {
    it('should pass for clean source code', async () => {
      const code = `
        const handler = async (input: any, context: any) => {
          return { success: true, data: { message: 'hello' } };
        };
        export default handler;
      `;
      const report = await service.validate(code);
      expect(report.valid).toBe(true);
      expect(report.issues.filter((i) => i.severity === 'error')).toHaveLength(
        0,
      );
    });

    it('should detect eval() usage', async () => {
      const code = `const result = eval('1 + 1');`;
      const report = await service.validate(code);
      expect(report.valid).toBe(false);
      expect(report.issues.some((i) => i.pattern === 'eval()')).toBe(true);
    });

    it('should detect new Function() usage', async () => {
      const code = `const fn = new Function('return 1');`;
      const report = await service.validate(code);
      expect(report.valid).toBe(false);
      expect(report.issues.some((i) => i.pattern === 'new Function()')).toBe(
        true,
      );
    });

    it('should detect require("child_process")', async () => {
      const code = `const cp = require('child_process');`;
      const report = await service.validate(code);
      expect(report.valid).toBe(false);
      expect(
        report.issues.some((i) => i.pattern.includes('child_process')),
      ).toBe(true);
    });

    it('should detect process.exit', async () => {
      const code = `process.exit(1);`;
      const report = await service.validate(code);
      expect(report.valid).toBe(false);
      expect(report.issues.some((i) => i.pattern === 'process.exit')).toBe(
        true,
      );
    });

    it('should warn about process.env access', async () => {
      const code = `const key = process.env.API_KEY;`;
      const report = await service.validate(code);
      // process.env is a warning, not an error
      expect(report.valid).toBe(true);
      expect(
        report.issues.some(
          (i) => i.pattern === 'process.env' && i.severity === 'warning',
        ),
      ).toBe(true);
    });

    it('should report error for empty source code', async () => {
      const report = await service.validate('');
      expect(report.valid).toBe(false);
    });

    it('should include line numbers in issues', async () => {
      const code = `const x = 1;\nconst y = eval('2');`;
      const report = await service.validate(code);
      const evalIssue = report.issues.find((i) => i.pattern === 'eval()');
      expect(evalIssue?.line).toBe(2);
    });
  });

  describe('validate — dry-run', () => {
    it('should successfully dry-run valid JavaScript', async () => {
      const code = `
        module.exports = { handler: () => ({ success: true }) };
      `;
      const report = await service.validate(code, true);
      expect(report.dryRun).toBeDefined();
      expect(report.dryRun!.success).toBe(true);
      expect(report.dryRun!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should catch runtime errors in dry-run', async () => {
      const code = `throw new Error('runtime failure');`;
      const report = await service.validate(code, true);
      expect(report.dryRun).toBeDefined();
      expect(report.dryRun!.success).toBe(false);
      expect(report.dryRun!.error).toContain('runtime failure');
    });

    it('should not include dryRun when not requested', async () => {
      const code = `const x = 1;`;
      const report = await service.validate(code, false);
      expect(report.dryRun).toBeUndefined();
    });
  });
});
