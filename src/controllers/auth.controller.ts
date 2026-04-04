import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser } from '../services/auth.service';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, name, password } = req.body;
    const result = await registerUser({ email, name, password });

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

    res.status(201).json({ data: result.user });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ data: result.user });
  } catch (error) {
    next(error);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('token', { path: '/' });
  res.json({ data: { message: 'Logout realizado com sucesso.' } });
}
