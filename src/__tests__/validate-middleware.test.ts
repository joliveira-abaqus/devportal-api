import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

describe('Validate Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let statusFn: jest.Mock;
  let jsonFn: jest.Mock;

  const testSchema = z.object({
    name: z.string().min(2),
    age: z.number().min(0),
  });

  beforeEach(() => {
    jsonFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    mockRes = { status: statusFn } as Partial<Response>;
    mockNext = jest.fn();
  });

  it('deve chamar next() sem erro quando o body é válido', () => {
    mockReq = { body: { name: 'João', age: 25 } };

    const middleware = validate(testSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith();
    expect(statusFn).not.toHaveBeenCalled();
  });

  it('deve responder 400 com VALIDATION_ERROR e details quando o body é inválido (ZodError)', () => {
    mockReq = { body: { name: 'A', age: -1 } };

    const middleware = validate(testSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação.',
          details: expect.any(Array),
        }),
      }),
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('deve chamar next(error) quando o erro não é ZodError', () => {
    const genericError = new Error('Erro inesperado');
    const faultySchema = {
      parse: () => {
        throw genericError;
      },
    };

    mockReq = { body: {} };

    const middleware = validate(faultySchema as unknown as z.ZodSchema);
    middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalledWith(genericError);
    expect(statusFn).not.toHaveBeenCalled();
  });
});
