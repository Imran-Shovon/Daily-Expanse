import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@expense/shared';
import type { Request, Response } from 'express';

/**
 * Converts every error into the shared ApiErrorBody shape. Unknown errors become a generic
 * 500 so internals (SQL, stack traces) never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, details } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.path} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiErrorBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      ...(details !== undefined ? { details } : {}),
      path: request.path,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; message: string; details?: unknown } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') return { status, message: res };
      const obj = res as { message?: unknown; details?: unknown };
      if (Array.isArray(obj.message)) {
        return { status, message: 'Validation failed', details: obj.message };
      }
      return {
        status,
        message: typeof obj.message === 'string' ? obj.message : exception.message,
        details: obj.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return {
            status: HttpStatus.CONFLICT,
            message: 'A record with these values already exists',
          };
        case 'P2003':
          return { status: HttpStatus.BAD_REQUEST, message: 'A referenced record does not exist' };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
