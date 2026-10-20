// src/common/filters/all-exceptions.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * PostgreSQL SQLSTATE codes we translate into predictable HTTP responses
 * instead of leaking a 500. Anything not listed here keeps falling through to
 * the generic handler (and is logged).
 */
const PG_ERROR_MAP: Record<string, { status: number; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, message: 'A record with these values already exists.' },
  '23503': { status: HttpStatus.BAD_REQUEST, message: 'Referenced record does not exist.' },
  '23502': { status: HttpStatus.BAD_REQUEST, message: 'A required field is missing.' },
};

/** Extract the SQLSTATE code from a pg / TypeORM QueryFailedError, if present. */
function databaseErrorCode(exception: unknown): string | undefined {
  if (!exception || typeof exception !== 'object') return undefined;
  const driverError = (exception as { driverError?: unknown }).driverError;
  const candidates = [driverError, exception];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      const code = (candidate as { code?: unknown }).code;
      if (typeof code === 'string') return code;
    }
  }
  return undefined;
}


@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const mapped = databaseErrorCode(exception);
    const mappedError = mapped ? PG_ERROR_MAP[mapped] : undefined;

    const status =
      mappedError?.status ??
      (exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR);

    const body: ErrorBody = {
      statusCode: status,
      error: this.resolveError(exception, status),
      message: mappedError?.message ?? this.resolveMessage(exception),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    const requestId = request.headers['x-request-id'];
    if (typeof requestId === 'string') {
      body.requestId = requestId;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${request.method} ${request.url} → ${status}`, detail);
    } else {
      this.logger.debug(`${request.method} ${request.url} → ${status}`);
    }

    response.status(status).json(body);
  }

  private resolveError(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (payload && typeof payload === 'object' && 'error' in payload) {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') return error;
      }
    }
    const fallback = HttpStatus[status];
    if (typeof fallback !== 'string') return 'Error';
    // enum reverse-mapping is SHOUTY_CASE → Title case
    return fallback.charAt(0) + fallback.slice(1).toLowerCase();
  }

  private resolveMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') return payload;
      if (payload && typeof payload === 'object' && 'message' in payload) {
        return (payload as { message: string | string[] }).message;
      }
      return exception.message;
    }

    // Never leak internal error details in production.
    return this.isProduction ? 'Internal server error' : String(exception);
  }
}
