import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtUser } from '../types/jwt-user.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtUser }>();
    return request.user;
  },
);
