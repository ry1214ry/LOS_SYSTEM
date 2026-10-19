// src/config/configuration.ts
import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { NodeEnvironment } from './env.validation.js';

/** Parses `CORS_ORIGINS="https://a.com,https://b.com"` into a string array. */
export function resolveCorsOrigins(config: ConfigService): string[] {
  return (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Maps the validated environment onto TypeORM options.
 *
 * Connection pooling is delegated to the `pg` driver: `max`/`min` bound the
 * number of sockets, `idleTimeoutMillis` recycles them, and
 * `connectionTimeoutMillis` fails fast instead of hanging a request when the
 * pool is exhausted. In front of a PgBouncer transaction pooler (which is the
 * recommended topology on managed Postgres), keep `DB_POOL_MAX` small — the
 * pooler owns the real server-side pool.
 */
export function resolveDatabaseOptions(config: ConfigService): TypeOrmModuleOptions {
  const url = config.get<string>('DATABASE_URL');
  const sslEnabled = config.get<boolean>('DB_SSL') === true;
  const isProduction = config.get<string>('NODE_ENV') === NodeEnvironment.Production;
  const logging: Array<'error' | 'warn' | 'schema'> = isProduction
    ? ['error']
    : ['error', 'warn'];

  const pool = {
    max: config.get<number>('DB_POOL_MAX', 20),
    min: config.get<number>('DB_POOL_MIN', 2),
    idleTimeoutMillis: config.get<number>('DB_IDLE_TIMEOUT_MS', 10_000),
    connectionTimeoutMillis: config.get<number>('DB_CONNECTION_TIMEOUT_MS', 10_000),
  };

  const shared = {
    type: 'postgres' as const,
    ssl: sslEnabled
      ? { rejectUnauthorized: config.get<boolean>('DB_REJECT_UNAUTHORIZED') !== false }
      : false,
    extra: pool,
    // Auto-load every entity registered through forFeature().
    autoLoadEntities: true,
    synchronize: config.get<boolean>('DB_SYNCHRONIZE') === true,
    logging,
  };

  if (url) {
    return { ...shared, url };
  }

  return {
    ...shared,
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USERNAME', 'postgres'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_DATABASE', 'LOS-SYSTEM'),
  };
}
