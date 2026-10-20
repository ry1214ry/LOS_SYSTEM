// src/config/env.validation.ts
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** `"true"` / `"1"` / `true` → true, everything else → false. */
const toBoolean = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1';

/**
 * Strongly-typed, validated view of the process environment.
 *
 * Boot fails fast (before the HTTP server starts listening) if any required
 * value is missing or malformed — an application running with a default or
 * empty JWT_SECRET is a security incident waiting to happen.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  HOST: string = '0.0.0.0';

  // ---- Database --------------------------------------------------------
  // Either DATABASE_URL (preferred for managed cloud Postgres) or the
  // discrete DB_* variables may be used. resolveDatabaseOptions() in
  // configuration.ts picks DATABASE_URL when present.
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  DB_HOST: string = 'localhost';

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsOptional()
  @IsString()
  DB_USERNAME: string = 'postgres';

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  DB_DATABASE: string = 'LOS-SYSTEM';

  @Transform(toBoolean)
  @IsBoolean()
  DB_SYNCHRONIZE: boolean = false;

  @Transform(toBoolean)
  @IsBoolean()
  DB_SSL: boolean = false;

  @Transform(toBoolean)
  @IsBoolean()
  DB_REJECT_UNAUTHORIZED: boolean = true;

  // ---- Connection pool -------------------------------------------------
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  DB_POOL_MAX: number = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  DB_POOL_MIN: number = 2;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  DB_IDLE_TIMEOUT_MS: number = 10_000;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  DB_CONNECTION_TIMEOUT_MS: number = 10_000;

  // ---- Auth ------------------------------------------------------------
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"',
  })
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string = '15m';

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  REFRESH_COOKIE_NAME: string = 'refresh_token';

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  /** Force the Secure flag on the refresh cookie (auto-enabled in prod). */
  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_ROUNDS: number = 12;

  // ---- HTTP hardening --------------------------------------------------
  /** Comma separated allow-list of browser origins. Required in prod. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_MS: number = 60_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT: number = 100;

  // ---- Bootstrap seed (optional) --------------------------------------
  @IsOptional()
  @IsString()
  SEED_SUPER_ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  SEED_SUPER_ADMIN_PASSWORD?: string;

  /** Runs the RBAC + bootstrap seed on application boot when true. */
  @Transform(toBoolean)
  @IsBoolean()
  SEED_ON_BOOT: boolean = false;
}

/**
 * `validate` hook for `ConfigModule.forRoot({ validate: validateEnv })`.
 * Throws a single, readable error listing every invalid variable.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
    validationError: { target: false, value: false },
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join('; ')
          : 'invalid value';
        return `  - ${error.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (validated.NODE_ENV === NodeEnvironment.Production) {
    if (!validated.DATABASE_URL && !validated.DB_PASSWORD) {
      throw new Error(
        'Invalid environment configuration:\n  - provide DATABASE_URL or DB_PASSWORD in production',
      );
    }
    if (!validated.CORS_ORIGINS) {
      throw new Error(
        'Invalid environment configuration:\n  - CORS_ORIGINS is required in production',
      );
    }
  }

  return validated;
}
