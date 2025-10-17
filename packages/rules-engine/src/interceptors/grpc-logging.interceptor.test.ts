import { ExecutionContext, CallHandler } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

import { GrpcLoggingInterceptor } from './grpc-logging.interceptor';

describe('GrpcLoggingInterceptor', () => {
  let interceptor: GrpcLoggingInterceptor;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;

  beforeEach(() => {
    interceptor = new GrpcLoggingInterceptor();

    // Mock execution context
    mockExecutionContext = {
      switchToRpc: jest.fn().mockReturnValue({
        getData: jest.fn().mockReturnValue({ test: 'data' }),
      }),
      getHandler: jest.fn().mockReturnValue({
        name: 'testMethod',
      }),
    };

    // Mock call handler
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  it('should log successful requests', (done) => {
    const response = { success: true };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(response));

    const logSpy = jest.spyOn(interceptor['logger'], 'log');
    const debugSpy = jest.spyOn(interceptor['logger'], 'debug');

    interceptor
      .intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: (result) => {
          expect(result).toEqual(response);
          expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('testMethod'));
          expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SUCCESS'));
          expect(debugSpy).toHaveBeenCalled();
          done();
        },
      });
  });

  it('should log and transform errors to RpcException', (done) => {
    const error = new Error('Test error');
    (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => error));

    const errorSpy = jest.spyOn(interceptor['logger'], 'error');

    interceptor
      .intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        error: (err) => {
          expect(err).toBeInstanceOf(RpcException);
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('ERROR'),
            expect.any(String)
          );
          done();
        },
      });
  });

  it('should not wrap RpcException errors', (done) => {
    const rpcError = new RpcException({ code: 5, message: 'Not found' });
    (mockCallHandler.handle as jest.Mock).mockReturnValue(throwError(() => rpcError));

    interceptor
      .intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        error: (err) => {
          expect(err).toBe(rpcError);
          done();
        },
      });
  });

  it('should measure request duration', (done) => {
    const response = { success: true };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(response));

    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    interceptor
      .intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: () => {
          expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/\(\d+ms\)/));
          done();
        },
      });
  });
});
