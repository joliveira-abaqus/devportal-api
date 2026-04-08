import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.middleware';
import { errorMiddleware, AppError } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    body: {},
    ...overrides,
  } as Request;
}

function mockResponse(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

describe('Auth Middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar 401 sem token no cookie', () => {
    const req = mockRequest({ cookies: {} });
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Token não fornecido.', code: 'UNAUTHORIZED' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 401 com token inválido/malformado', () => {
    const req = mockRequest({ cookies: { token: 'token-invalido-xyz' } });
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Token inválido ou expirado.', code: 'UNAUTHORIZED' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('deve retornar 401 com token expirado', () => {
    const expiredToken = jwt.sign(
      { userId: 'user-1', email: 'test@devportal.local' },
      JWT_SECRET,
      { expiresIn: '0s' },
    );
    const req = mockRequest({ cookies: { token: expiredToken } });
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Token inválido ou expirado.', code: 'UNAUTHORIZED' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('deve popular req.user e chamar next() com token válido', () => {
    const validToken = jwt.sign(
      { userId: 'user-1', email: 'test@devportal.local' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    const req = mockRequest({ cookies: { token: validToken } });
    const res = mockResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.userId).toBe('user-1');
    expect(req.user!.email).toBe('test@devportal.local');
  });
});

describe('Error Middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve responder com statusCode, code e message do erro', () => {
    const err: AppError = new Error('Recurso não encontrado.');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';

    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Recurso não encontrado.', code: 'NOT_FOUND' },
    });
  });

  it('deve usar fallback 500 quando erro não tem statusCode', () => {
    const err: AppError = new Error('Algo deu errado');

    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('deve usar fallback INTERNAL_ERROR quando erro não tem code', () => {
    const err: AppError = new Error('Algo deu errado');

    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    errorMiddleware(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Algo deu errado', code: 'INTERNAL_ERROR' },
    });
  });

  it('deve usar fallback "Erro interno do servidor." quando erro não tem message', () => {
    const err: AppError = new Error();
    err.statusCode = 500;

    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();

    errorMiddleware(err, req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Erro interno do servidor.', code: 'INTERNAL_ERROR' },
    });
  });
});

describe('Validate Middleware', () => {
  const testSchema = z.object({
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres.'),
    email: z.string().email('Email inválido.'),
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve chamar next() quando body é válido', () => {
    const req = mockRequest({ body: { name: 'Teste', email: 'test@example.com' } });
    const res = mockResponse();
    const next = jest.fn();

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deve retornar 400 com VALIDATION_ERROR quando body é inválido (ZodError)', () => {
    const req = mockRequest({ body: { name: 'Ab', email: 'invalido' } });
    const res = mockResponse();
    const next = jest.fn();

    const middleware = validate(testSchema);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Erro de validação.',
          details: expect.any(Array),
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('deve chamar next(error) para erro não-Zod', () => {
    const genericError = new Error('Erro genérico inesperado');
    const failSchema = {
      parse: jest.fn().mockImplementation(() => {
        throw genericError;
      }),
    };

    const req = mockRequest({ body: { name: 'Teste' } });
    const res = mockResponse();
    const next = jest.fn();

    const middleware = validate(failSchema as unknown as z.ZodSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(genericError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
