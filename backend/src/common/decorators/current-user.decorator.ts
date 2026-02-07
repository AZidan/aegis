import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() parameter decorator
 * Extracts the authenticated user from the request object (set by JwtAuthGuard / JwtStrategy).
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);
