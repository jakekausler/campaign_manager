import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * Interceptor for gRPC requests that provides:
 * - Request/response logging
 * - Error handling and transformation
 * - Performance timing
 */
@Injectable()
export class GrpcLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('gRPC');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const rpcContext = context.switchToRpc();
    const methodName = context.getHandler().name;
    const data = rpcContext.getData();

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Log incoming request
    this.logger.log(`[${requestId}] --> ${methodName}`);
    this.logger.debug(`[${requestId}] Request: ${JSON.stringify(data)}`);

    return next.handle().pipe(
      tap((response) => {
        // Log successful response
        const duration = Date.now() - startTime;
        this.logger.log(`[${requestId}] <-- ${methodName} (${duration}ms) [SUCCESS]`);
        this.logger.debug(`[${requestId}] Response: ${JSON.stringify(response)}`);
      }),
      catchError((error) => {
        // Log error
        const duration = Date.now() - startTime;
        this.logger.error(`[${requestId}] <-- ${methodName} (${duration}ms) [ERROR]`, error.stack);

        // Transform errors to gRPC errors
        if (error instanceof RpcException) {
          return throwError(() => error);
        }

        // Wrap other errors in RpcException
        return throwError(
          () =>
            new RpcException({
              code: 13, // INTERNAL gRPC status code
              message: error.message || 'Internal server error',
              details: error.stack,
            })
        );
      })
    );
  }

  /**
   * Generate a simple request ID for correlation
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
