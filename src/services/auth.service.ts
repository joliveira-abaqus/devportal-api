import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'devportal-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';

interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  user: { id: string; email: string; name: string };
  token: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    const error = new Error('Email já cadastrado.') as Error & { statusCode: number; code: string };
    error.statusCode = 400;
    error.code = 'EMAIL_EXISTS';
    throw error;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
    },
  });

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    const error = new Error('Credenciais inválidas.') as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    const error = new Error('Credenciais inválidas.') as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    token,
  };
}
