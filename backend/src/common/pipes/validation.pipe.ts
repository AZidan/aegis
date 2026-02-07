import { PipeTransform, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { ZodType, ZodError, ZodIssue } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const error = result.error as ZodError;
      const details: Record<string, string[]> = {};

      error.issues.forEach((issue: ZodIssue) => {
        const field = issue.path.map(String).join('.') || 'body';
        const message = issue.message;

        if (!details[field]) {
          details[field] = [];
        }
        details[field].push(message);
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message: 'Validation failed',
          details,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return result.data;
  }
}
