// src/main.ts
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { resolveCorsOrigins } from './config/configuration.js';
import { NodeEnvironment } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const isProduction = config.get<string>('NODE_ENV') === NodeEnvironment.Production;

  // Behind a load balancer / ingress, trust the first proxy hop so req.ip and
  // the throttler see the real client address.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Parses the HttpOnly refresh cookie into req.cookies.
  app.use(cookieParser());

  // ---- Security headers ------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // ---- Strict CORS -----------------------------------------------------
  const corsOrigins = resolveCorsOrigins(config);
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        // Same-origin / server-to-server calls have no Origin header.
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        logger.warn(`Blocked CORS origin: ${origin}`);
        callback(null, false);
      },
      credentials: true, // required for the refresh cookie
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    });
  } else if (isProduction) {
    // validateEnv() already enforces this; belt and braces.
    throw new Error('CORS_ORIGINS must be configured in production.');
  } else {
    logger.warn('CORS_ORIGINS is empty — cross-origin browser requests are disabled.');
  }

  // ---- Request validation ---------------------------------------------
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  // ---- Consistent error envelope --------------------------------------
  app.useGlobalFilters(new AllExceptionsFilter(isProduction));

  // Emit shutdown hooks so TypeORM closes the pool on SIGTERM.
  app.enableShutdownHooks();

  const host = config.get<string>('HOST', '0.0.0.0');
  const port = config.get<number>('PORT', 3000);

  await app.listen(port, host);
  logger.log(`LOS API listening on http://${host}:${port} (${config.get<string>('NODE_ENV')})`);
}

// Unhandled rejections at boot should crash loudly rather than serve a
// half-configured process.
bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal error during bootstrap', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
