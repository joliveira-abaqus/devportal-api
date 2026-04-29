import { Request, Response, NextFunction } from 'express';
import { errorMiddleware, AppError } from '../middleware/error.middleware';

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusFn: jest.Mock;
  let jsonFn: jest.Mock;

  beforeEach(() => {
    mockReq = {};
    jsonFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    mockRes = { status: statusFn } as Partial<Response>;
    mockNext = jest.fn();
  });

  it('deve responder com statusCode e code customizados', () => {
    const err: AppError = new Error('Recurso não encontrado.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';

    errorMiddleware(err, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(404);
    expect(jsonFn).toHaveBeenCalledWith({
      error: {
        message: 'Recurso não encontrado.',
        code: 'NOT_FOUND',
      },
    });
  });

  it('deve responder com 500 e INTERNAL_ERROR para erro genérico sem statusCode', () => {
    const err: AppError = new Error('Algo deu errado');

    errorMiddleware(err, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({
      error: {
        message: 'Algo deu errado',
        code: 'INTERNAL_ERROR',
      },
    });
  });

  it('deve responder com mensagem padrão quando o erro não tem mensagem', () => {
    const err: AppError = new Error();

    errorMiddleware(err, mockReq as Request, mockRes as Response, mockNext);

    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith({
      error: {
        message: 'Erro interno do servidor.',
        code: 'INTERNAL_ERROR',
      },
    });
  });
});
