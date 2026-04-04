import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../config/database';

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

// Mock do SQS
jest.mock('../services/queue.service', () => ({
  sendToQueue: jest.fn().mockResolvedValue('mock-message-id'),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const JWT_SECRET = process.env.JWT_SECRET || 'devportal-jwt-secret-change-in-production';

function generateAuthCookie(): string {
  const token = jwt.sign({ userId: 'test-user-id', email: 'test@devportal.local' }, JWT_SECRET, {
    expiresIn: '1h',
  });
  return `token=${token}`;
}

describe('Requests Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /requests', () => {
    it('deve retornar 401 sem autenticação', async () => {
      const res = await request(app).get('/requests');
      expect(res.status).toBe(401);
    });

    it('deve retornar lista de solicitações com autenticação', async () => {
      (mockPrisma.request.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'req-1',
          title: 'Teste',
          description: 'Descrição de teste',
          type: 'bug_fix',
          status: 'pending',
          authorId: 'test-user-id',
          author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await request(app)
        .get('/requests')
        .set('Cookie', generateAuthCookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('POST /requests', () => {
    it('deve criar uma nova solicitação', async () => {
      const mockRequest = {
        id: 'new-req-id',
        title: 'Nova solicitação',
        description: 'Descrição detalhada da solicitação',
        type: 'feature',
        status: 'pending',
        authorId: 'test-user-id',
        author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.request.create as jest.Mock).mockResolvedValue(mockRequest);
      (mockPrisma.requestEvent.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .post('/requests')
        .set('Cookie', generateAuthCookie())
        .send({
          title: 'Nova solicitação',
          description: 'Descrição detalhada da solicitação',
          type: 'feature',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Nova solicitação');
    });

    it('deve retornar 400 se dados inválidos', async () => {
      const res = await request(app)
        .post('/requests')
        .set('Cookie', generateAuthCookie())
        .send({
          title: 'AB',
          description: 'curta',
          type: 'invalido',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /requests/:id', () => {
    it('deve retornar uma solicitação por ID', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        title: 'Teste',
        description: 'Descrição',
        type: 'bug_fix',
        status: 'pending',
        authorId: 'test-user-id',
        author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
        events: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/requests/req-1')
        .set('Cookie', generateAuthCookie());

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('req-1');
    });

    it('deve retornar 404 se não encontrada', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/requests/inexistente')
        .set('Cookie', generateAuthCookie());

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /requests/:id', () => {
    it('deve atualizar o status de uma solicitação', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'pending',
      });

      (mockPrisma.request.update as jest.Mock).mockResolvedValue({
        id: 'req-1',
        title: 'Teste',
        description: 'Descrição',
        type: 'bug_fix',
        status: 'in_progress',
        authorId: 'test-user-id',
        author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.requestEvent.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .patch('/requests/req-1')
        .set('Cookie', generateAuthCookie())
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_progress');
    });

    it('deve retornar 400 para transição de status inválida', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'pending',
      });

      const res = await request(app)
        .patch('/requests/req-1')
        .set('Cookie', generateAuthCookie())
        .send({ status: 'done' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });
  });
});
