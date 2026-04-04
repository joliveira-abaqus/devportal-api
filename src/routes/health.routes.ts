import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import redis from '../config/redis';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ data: checks });
});

export default router;
