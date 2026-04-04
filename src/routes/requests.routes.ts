import { Router } from 'express';
import { z } from 'zod';
import { list, getById, create, update } from '../controllers/requests.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

const createRequestSchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres.'),
  description: z.string().min(10, 'Descrição deve ter no mínimo 10 caracteres.'),
  type: z.enum(['bug_fix', 'feature', 'migration'], {
    error: 'Tipo deve ser bug_fix, feature ou migration.',
  }),
  attachmentS3: z.string().optional(),
});

const updateRequestSchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'review', 'done', 'failed'], {
      error: 'Status inválido.',
    })
    .optional(),
  prUrl: z.string().url('URL do PR inválida.').optional(),
});

router.get('/requests', authMiddleware, list);
router.post('/requests', authMiddleware, validate(createRequestSchema), create);
router.get('/requests/:id', authMiddleware, getById);
router.patch('/requests/:id', authMiddleware, validate(updateRequestSchema), update);

export default router;
