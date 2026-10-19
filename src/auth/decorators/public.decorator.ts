// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public so the globally-registered JwtAuthGuard skips it.
 * Auth is deny-by-default: every route requires a valid token unless it is
 * explicitly annotated with `@Public()`.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
