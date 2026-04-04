import { Router } from 'express';
import { z } from 'zod';
import { register, login, logout } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Email inválido.'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

router.post('/auth/register', validate(registerSchema), register);
router.post('/auth/login', validate(loginSchema), login);
router.post('/auth/logout', logout);

export default router;
