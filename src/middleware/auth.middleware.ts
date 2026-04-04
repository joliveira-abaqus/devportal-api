import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'devportal-jwt-secret-change-in-production';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    res.status(401).json({ error: { message: 'Token não fornecido.', code: 'UNAUTHORIZED' } });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: { message: 'Token inválido ou expirado.', code: 'UNAUTHORIZED' } });
  }
}
