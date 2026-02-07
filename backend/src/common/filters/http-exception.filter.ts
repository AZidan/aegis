import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, string[]>;
  timestamp: string;
  path: string;
}

/**
 * HTTP status code to human-readable error name mapping
 * Matches API Contract v1.1.0 error response format
 */
const HTTP_ERROR_NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.GONE]: 'Gone',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse: ApiError = {
      statusCode: status,
      error: HTTP_ERROR_NAMES[status] || HttpStatus[status] || 'Error',
      message: '',
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as Record<string, unknown>;

      // Use the error name from the response if provided (e.g., from validation pipe)
      if (typeof responseObj.error === 'string') {
        errorResponse.error = responseObj.error;
      }

      if (typeof responseObj.message === 'string') {
        errorResponse.message = responseObj.message;
      } else if (Array.isArray(responseObj.message)) {
        errorResponse.message = 'Validation failed';
        errorResponse.details = this.formatValidationErrors(responseObj.message);
      }

      // Override statusCode if provided (e.g., validation pipe sends 422)
      if (typeof responseObj.statusCode === 'number') {
        errorResponse.statusCode = responseObj.statusCode;
      }

      if (responseObj.details && typeof responseObj.details === 'object') {
        errorResponse.details = responseObj.details as Record<string, string[]>;
      }
    } else if (typeof exceptionResponse === 'string') {
      errorResponse.message = exceptionResponse;
    }

    if (!errorResponse.message) {
      errorResponse.message = exception.message || 'An error occurred';
    }

    response.status(status).json(errorResponse);
  }

  private formatValidationErrors(messages: string[]): Record<string, string[]> {
    const details: Record<string, string[]> = {};

    messages.forEach((message) => {
      const match = message.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, field, error] = match;
        if (!details[field]) {
          details[field] = [];
        }
        details[field].push(error);
      } else {
        if (!details.general) {
          details.general = [];
        }
        details.general.push(message);
      }
    });

    return details;
  }
}
