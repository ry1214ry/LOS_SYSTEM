// src/auth/refresh-cookie.config.ts
import type { CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { parseDurationToMs } from '../common/utils/duration.js';

/** The refresh cookie is only ever sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = '/auth';

const SEVEN_DAYS_MS = 7 * 86_400_000;

export function getRefreshTtlMs(config: ConfigService): number {
  return parseDurationToMs(config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'), SEVEN_DAYS_MS);
}

export function getRefreshCookieName(config: ConfigService): string {
  return config.get<string>('REFRESH_COOKIE_NAME', 'refresh_token');
}

/**
 * HttpOnly + SameSite=Strict by default. `Secure` is forced on in production
 * (or whenever COOKIE_SECURE=true) so the cookie never travels over plaintext.
 */
export function getRefreshCookieOptions(
  config: ConfigService,
  maxAgeMs?: number,
): CookieOptions {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const domain = config.get<string>('COOKIE_DOMAIN');

  return {
    httpOnly: true,
    secure: isProduction || config.get<boolean>('COOKIE_SECURE') === true,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(domain ? { domain } : {}),
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}
