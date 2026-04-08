import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import redis from '../config/redis';

// Mock do Prisma
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    request: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    requestEvent: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

// Mock do Redis
jest.mock('../config/redis', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    quit: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRedis = redis as jest.Mocked<typeof redis>;

describe('Health Check - GET /health', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar 200 com tudo OK quando database e redis respondem', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    (mockRedis.ping as jest.Mock).mockResolvedValue('PONG');

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      api: 'ok',
      database: 'ok',
      redis: 'ok',
    });
  });

  it('deve retornar 503 quando database falha', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database connection refused'));
    (mockRedis.ping as jest.Mock).mockResolvedValue('PONG');

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.data.api).toBe('ok');
    expect(res.body.data.database).toBe('error');
    expect(res.body.data.redis).toBe('ok');
  });

  it('deve retornar 503 quando redis falha', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    (mockRedis.ping as jest.Mock).mockRejectedValue(new Error('Redis connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.data.api).toBe('ok');
    expect(res.body.data.database).toBe('ok');
    expect(res.body.data.redis).toBe('error');
  });

  it('deve retornar 503 quando ambos falham', async () => {
    (mockPrisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database error'));
    (mockRedis.ping as jest.Mock).mockRejectedValue(new Error('Redis error'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.data).toEqual({
      api: 'ok',
      database: 'error',
      redis: 'error',
    });
  });
});
