import { Injectable, Logger } from '@nestjs/common';
import * as ts from 'typescript';
import * as vm from 'vm';
import {
  ValidationReport,
  ValidationIssue,
} from './interfaces/validation-report.interface';

@Injectable()
export class SkillValidatorService {
  private readonly logger = new Logger(SkillValidatorService.name);

  /**
   * Validate skill source code using AST-based static analysis.
   * Optionally perform a dry-run in a sandboxed vm context.
   */
  async validate(
    sourceCode: string,
    dryRun = false,
  ): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];

    // 1. Parse the source code into an AST
    const sourceFile = ts.createSourceFile(
      'skill.ts',
      sourceCode,
      ts.ScriptTarget.ES2022,
      true,
    );

    // Check for empty source
    if (sourceCode.trim().length === 0) {
      issues.push({
        severity: 'error',
        pattern: '',
        message: 'Source code is empty',
      });
      return { valid: false, issues };
    }

    // 2. Walk the AST to detect dangerous patterns
    this.walkNode(sourceFile, sourceCode, issues);

    // 3. Text-based pattern matching for patterns harder to detect via AST
    this.checkTextPatterns(sourceCode, issues);

    // 4. Optional dry-run in sandbox
    let dryRunResult: ValidationReport['dryRun'] | undefined;
    if (dryRun) {
      dryRunResult = await this.executeDryRun(sourceCode);
    }

    const hasErrors = issues.some((i) => i.severity === 'error');

    return {
      valid: !hasErrors,
      issues,
      dryRun: dryRunResult,
    };
  }

  /**
   * Walk the TypeScript AST to detect dangerous patterns.
   */
  private walkNode(
    node: ts.Node,
    sourceCode: string,
    issues: ValidationIssue[],
  ): void {
    // Detect eval() calls
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'eval'
    ) {
      const { line } = ts.getLineAndCharacterOfPosition(
        node.getSourceFile(),
        node.getStart(),
      );
      issues.push({
        severity: 'error',
        pattern: 'eval()',
        message:
          'Use of eval() is forbidden — it allows arbitrary code execution',
        line: line + 1,
      });
    }

    // Detect new Function()
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Function'
    ) {
      const { line } = ts.getLineAndCharacterOfPosition(
        node.getSourceFile(),
        node.getStart(),
      );
      issues.push({
        severity: 'error',
        pattern: 'new Function()',
        message:
          'Use of new Function() is forbidden — it allows arbitrary code execution',
        line: line + 1,
      });
    }

    // Detect require('child_process')
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === 'child_process'
    ) {
      const { line } = ts.getLineAndCharacterOfPosition(
        node.getSourceFile(),
        node.getStart(),
      );
      issues.push({
        severity: 'error',
        pattern: "require('child_process')",
        message:
          'Use of child_process is forbidden — use allowed network APIs instead',
        line: line + 1,
      });
    }

    // Detect process.exit
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process' &&
      node.name.text === 'exit'
    ) {
      const { line } = ts.getLineAndCharacterOfPosition(
        node.getSourceFile(),
        node.getStart(),
      );
      issues.push({
        severity: 'error',
        pattern: 'process.exit',
        message:
          'Use of process.exit() is forbidden — skills must not terminate the host process',
        line: line + 1,
      });
    }

    // Detect process.env
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process' &&
      node.name.text === 'env'
    ) {
      const { line } = ts.getLineAndCharacterOfPosition(
        node.getSourceFile(),
        node.getStart(),
      );
      issues.push({
        severity: 'warning',
        pattern: 'process.env',
        message:
          'Direct process.env access detected — declare required env vars in the permission manifest instead',
        line: line + 1,
      });
    }

    ts.forEachChild(node, (child) => this.walkNode(child, sourceCode, issues));
  }

  /**
   * Additional text-based pattern matching for edge cases.
   */
  private checkTextPatterns(
    sourceCode: string,
    issues: ValidationIssue[],
  ): void {
    const lines = sourceCode.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for dynamic import of dangerous modules
      if (/import\s*\(\s*['"]child_process['"]\s*\)/.test(line)) {
        issues.push({
          severity: 'error',
          pattern: "import('child_process')",
          message: 'Dynamic import of child_process is forbidden',
          line: i + 1,
        });
      }

      // Check for __proto__ manipulation
      if (/__proto__/.test(line)) {
        issues.push({
          severity: 'warning',
          pattern: '__proto__',
          message:
            '__proto__ manipulation detected — this may indicate prototype pollution',
          line: i + 1,
        });
      }
    }
  }

  /**
   * Execute the skill source code in a sandboxed vm context for dry-run.
   * The sandbox has a 5-second timeout and limited globals.
   */
  private async executeDryRun(
    sourceCode: string,
  ): Promise<NonNullable<ValidationReport['dryRun']>> {
    const startTime = Date.now();

    try {
      // Compile TypeScript to JavaScript first
      const result = ts.transpileModule(sourceCode, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      });

      const jsCode = result.outputText;

      // Create a restricted sandbox context
      const sandbox = {
        console: {
          log: () => {},
          warn: () => {},
          error: () => {},
          info: () => {},
        },
        setTimeout: undefined,
        setInterval: undefined,
        setImmediate: undefined,
        require: undefined,
        process: undefined,
        __dirname: '/sandbox',
        __filename: '/sandbox/skill.js',
        module: { exports: {} },
        exports: {},
      };

      const context = vm.createContext(sandbox);

      // Run with 5 second timeout
      const script = new vm.Script(jsCode, { filename: 'skill.js' });
      script.runInContext(context, { timeout: 5000 });

      return {
        success: true,
        output: sandbox.module.exports,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }
}
