import prisma from '../config/database';
import redis from '../config/redis';
import { sendToQueue } from './queue.service';

const CACHE_KEY_REQUESTS = 'requests:list';
const CACHE_TTL = 300; // 5 minutos

const VALID_STATUSES = ['pending', 'in_progress', 'review', 'done', 'failed'] as const;
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'failed'],
  in_progress: ['review', 'failed'],
  review: ['done', 'failed'],
  done: [],
  failed: [],
};

interface CreateRequestInput {
  title: string;
  description: string;
  type: string;
  authorId: string;
  attachmentS3?: string;
}

interface UpdateRequestInput {
  status?: string;
  prUrl?: string;
}

export async function listRequests(
  cursor?: string,
  limit = 20,
): Promise<{ data: unknown[]; nextCursor: string | null }> {
  const cacheKey = `${CACHE_KEY_REQUESTS}:${cursor || 'start'}:${limit}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as { data: unknown[]; nextCursor: string | null };
  }

  const requests = await prisma.request.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, email: true, name: true } } },
  });

  const hasMore = requests.length > limit;
  const data = hasMore ? requests.slice(0, limit) : requests;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  const result = { data, nextCursor };
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

  return result;
}

export async function getRequestById(id: string): Promise<unknown> {
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, email: true, name: true } },
      events: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!request) {
    const error = new Error('Solicitação não encontrada.') as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return request;
}

export async function createRequest(input: CreateRequestInput): Promise<unknown> {
  const request = await prisma.request.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      authorId: input.authorId,
      attachmentS3: input.attachmentS3,
    },
    include: { author: { select: { id: true, email: true, name: true } } },
  });

  await prisma.requestEvent.create({
    data: {
      requestId: request.id,
      eventType: 'status_change',
      payload: { from: null, to: 'pending' },
    },
  });

  await invalidateCache();

  try {
    await sendToQueue({
      requestId: request.id,
      type: request.type,
      title: request.title,
      authorId: request.authorId,
    });
  } catch (err) {
    console.error('Falha ao enviar mensagem para SQS:', err);
  }

  return request;
}

export async function updateRequest(id: string, input: UpdateRequestInput): Promise<unknown> {
  const existing = await prisma.request.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error('Solicitação não encontrada.') as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (input.status) {
    if (!VALID_STATUSES.includes(input.status as (typeof VALID_STATUSES)[number])) {
      const error = new Error(`Status inválido: ${input.status}`) as Error & {
        statusCode: number;
        code: string;
      };
      error.statusCode = 400;
      error.code = 'INVALID_STATUS';
      throw error;
    }

    const allowed = VALID_TRANSITIONS[existing.status];
    if (!allowed || !allowed.includes(input.status)) {
      const error = new Error(
        `Transição de status não permitida: ${existing.status} -> ${input.status}`,
      ) as Error & { statusCode: number; code: string };
      error.statusCode = 400;
      error.code = 'INVALID_TRANSITION';
      throw error;
    }
  }

  const updated = await prisma.request.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.prUrl !== undefined ? { prUrl: input.prUrl } : {}),
    },
    include: { author: { select: { id: true, email: true, name: true } } },
  });

  if (input.status) {
    await prisma.requestEvent.create({
      data: {
        requestId: id,
        eventType: 'status_change',
        payload: { from: existing.status, to: input.status },
      },
    });
  }

  if (input.prUrl) {
    await prisma.requestEvent.create({
      data: {
        requestId: id,
        eventType: 'pr_linked',
        payload: { prUrl: input.prUrl },
      },
    });
  }

  await invalidateCache();

  return updated;
}

async function invalidateCache(): Promise<void> {
  const keys = await redis.keys(`${CACHE_KEY_REQUESTS}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
