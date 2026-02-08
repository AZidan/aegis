import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';

/**
 * URL pattern → target type mapping.
 * Order matters: more specific patterns first.
 */
const TARGET_TYPE_MAP: Array<{ pattern: RegExp; targetType: string; idParam?: string }> = [
  { pattern: /\/api\/admin\/tenants\/([^/]+)/, targetType: 'tenant', idParam: '$1' },
  { pattern: /\/api\/admin\/tenants/, targetType: 'tenant' },
  { pattern: /\/api\/dashboard\/agents\/([^/]+)/, targetType: 'agent', idParam: '$1' },
  { pattern: /\/api\/dashboard\/agents/, targetType: 'agent' },
  { pattern: /\/api\/dashboard\/skills\/([^/]+)/, targetType: 'skill', idParam: '$1' },
  { pattern: /\/api\/dashboard\/skills/, targetType: 'skill' },
  { pattern: /\/api\/auth/, targetType: 'user' },
];

/**
 * Derive a human-readable action name from HTTP method + URL path.
 */
function deriveAction(method: string, url: string): string {
  // Strip query params
  const path = url.split('?')[0];

  // Specific path segments that add context
  const segments = path.split('/').filter(Boolean);

  // Find the resource type from the URL
  let resource = 'resource';
  if (path.includes('/tenants')) resource = 'tenant';
  else if (path.includes('/agents')) resource = 'agent';
  else if (path.includes('/skills')) resource = 'skill';
  else if (path.includes('/auth')) resource = 'auth';

  // Check for sub-resource actions (e.g., /config, /suspend, /restart)
  const lastSegment = segments[segments.length - 1];
  const isIdSegment = lastSegment && /^[0-9a-f-]{8,}$/.test(lastSegment);
  const actionSegment = isIdSegment
    ? segments[segments.length - 2]
    : lastSegment;

  // Special sub-resource actions
  if (actionSegment === 'config') {
    return `${resource}_config_updated`;
  }
  if (actionSegment === 'suspend') {
    return `${resource}_suspended`;
  }
  if (actionSegment === 'restart') {
    return `${resource}_restarted`;
  }

  // Standard CRUD mapping
  switch (method) {
    case 'POST':
      return `${resource}_created`;
    case 'PUT':
    case 'PATCH':
      return `${resource}_updated`;
    case 'DELETE':
      return `${resource}_deleted`;
    default:
      return `${resource}_${method.toLowerCase()}`;
  }
}

/**
 * Extract target type and target ID from the request URL.
 */
function extractTarget(url: string, user?: any): { targetType: string; targetId: string } {
  const path = url.split('?')[0];

  for (const mapping of TARGET_TYPE_MAP) {
    const match = path.match(mapping.pattern);
    if (match) {
      const targetId = mapping.idParam ? match[1] || 'unknown' : 'unknown';
      return { targetType: mapping.targetType, targetId };
    }
  }

  // Fallback for auth routes
  if (path.includes('/auth') && user) {
    return { targetType: 'user', targetId: user.userId || user.id || 'unknown' };
  }

  return { targetType: 'user', targetId: 'unknown' };
}

/**
 * AuditInterceptor
 *
 * Global NestJS interceptor that automatically captures all POST/PUT/PATCH/DELETE
 * requests and enqueues audit events via AuditService.
 *
 * - Skips GET/HEAD/OPTIONS (read-only, no audit needed)
 * - Extracts actor from JWT (request.user)
 * - Derives action and target from URL pattern
 * - Logs both successful and failed requests
 * - Adds < 5ms overhead (only enqueues, never awaits DB write)
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip, body } = request;

    // Skip read-only methods — no audit needed
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const user = (request as any).user;
    const { targetType, targetId } = extractTarget(url, user);
    const action = deriveAction(method, url);

    const actorType = user ? 'user' : 'system';
    const actorId = user?.userId || user?.id || 'anonymous';
    const actorName = user?.email || 'system';

    return next.handle().pipe(
      tap(() => {
        // On success: enqueue audit event (fire-and-forget)
        this.auditService.logAction({
          actorType: actorType as 'user' | 'system',
          actorId,
          actorName,
          action,
          targetType: targetType as any,
          targetId,
          details: body && typeof body === 'object' ? { requestBody: body } : null,
          severity: 'info',
          ipAddress: ip || null,
          userAgent: request.get('user-agent') || null,
          tenantId: user?.tenantId || null,
          userId: user?.userId || user?.id || null,
        });
      }),
      catchError((error) => {
        // On error: still log the failed attempt
        this.auditService.logAction({
          actorType: actorType as 'user' | 'system',
          actorId,
          actorName,
          action,
          targetType: targetType as any,
          targetId,
          details: {
            requestBody: body && typeof body === 'object' ? body : null,
            error: error?.message || String(error),
            statusCode: error?.status || error?.statusCode || 500,
          },
          severity: error?.status >= 500 ? 'error' : 'warning',
          ipAddress: ip || null,
          userAgent: request.get('user-agent') || null,
          tenantId: user?.tenantId || null,
          userId: user?.userId || user?.id || null,
        });

        // Re-throw to not swallow the error
        throw error;
      }),
    );
  }
}
