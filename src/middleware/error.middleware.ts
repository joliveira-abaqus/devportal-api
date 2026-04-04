import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorMiddleware(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Erro interno do servidor.';

  console.error(`[ERROR] ${statusCode} - ${code}: ${message}`, err.stack);

  res.status(statusCode).json({
    error: {
      message,
      code,
    },
  });
}
