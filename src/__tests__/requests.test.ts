import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import prisma from '../config/database';
import redis from '../config/redis';
import { sendToQueue } from '../services/queue.service';

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
const mockRedis = redis as jest.Mocked<typeof redis>;
const mockSendToQueue = sendToQueue as jest.MockedFunction<typeof sendToQueue>;

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

    it('deve retornar dados do cache quando há cache hit', async () => {
      const cachedData = {
        data: [{ id: 'cached-req', title: 'Do Cache' }],
        nextCursor: null,
      };
      (mockRedis.get as jest.Mock).mockResolvedValue(JSON.stringify(cachedData));

      const res = await request(app)
        .get('/requests')
        .set('Cookie', generateAuthCookie());

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(cachedData.data);
      expect(mockPrisma.request.findMany).not.toHaveBeenCalled();
    });

    it('deve consultar Prisma e setar cache quando há cache miss', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.request.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'req-db',
          title: 'Do Banco',
          description: 'Descrição',
          type: 'feature',
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
      expect(mockPrisma.request.findMany).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('deve aceitar parâmetros de paginação cursor e limit', async () => {
      (mockRedis.get as jest.Mock).mockResolvedValue(null);
      (mockPrisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const res = await request(app)
        .get('/requests?cursor=some-cursor-id&limit=5')
        .set('Cookie', generateAuthCookie());

      expect(res.status).toBe(200);
      expect(mockPrisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 6,
          cursor: { id: 'some-cursor-id' },
          skip: 1,
        }),
      );
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

  describe('POST /requests', () => {
    it('deve criar com attachmentS3 preenchido', async () => {
      const mockRequest = {
        id: 'req-attach',
        title: 'Solicitação com anexo',
        description: 'Descrição com anexo S3 preenchido',
        type: 'bug_fix',
        status: 'pending',
        attachmentS3: 'uploads/arquivo.pdf',
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
          title: 'Solicitação com anexo',
          description: 'Descrição com anexo S3 preenchido',
          type: 'bug_fix',
          attachmentS3: 'uploads/arquivo.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attachmentS3).toBe('uploads/arquivo.pdf');
    });

    it('deve criar a request mesmo quando sendToQueue falha', async () => {
      mockSendToQueue.mockRejectedValue(new Error('SQS indisponível'));

      const mockRequest = {
        id: 'req-sqs-fail',
        title: 'Solicitação sem fila',
        description: 'Descrição com falha no SQS durante criação',
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
          title: 'Solicitação sem fila',
          description: 'Descrição com falha no SQS durante criação',
          type: 'feature',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('req-sqs-fail');
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

    it('deve retornar 404 quando a request não existe', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .patch('/requests/inexistente')
        .set('Cookie', generateAuthCookie())
        .send({ status: 'in_progress' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('deve retornar 400 para status completamente inválido (validação Zod)', async () => {
      const res = await request(app)
        .patch('/requests/req-1')
        .set('Cookie', generateAuthCookie())
        .send({ status: 'xyz' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve atualizar apenas prUrl sem status e criar evento pr_linked', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-pr',
        status: 'in_progress',
      });

      (mockPrisma.request.update as jest.Mock).mockResolvedValue({
        id: 'req-pr',
        title: 'Teste PR',
        description: 'Descrição',
        type: 'feature',
        status: 'in_progress',
        prUrl: 'https://github.com/org/repo/pull/1',
        authorId: 'test-user-id',
        author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.requestEvent.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .patch('/requests/req-pr')
        .set('Cookie', generateAuthCookie())
        .send({ prUrl: 'https://github.com/org/repo/pull/1' });

      expect(res.status).toBe(200);
      expect(res.body.data.prUrl).toBe('https://github.com/org/repo/pull/1');
      expect(mockPrisma.requestEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'pr_linked',
            payload: { prUrl: 'https://github.com/org/repo/pull/1' },
          }),
        }),
      );
    });

    it('deve atualizar prUrl e status simultaneamente', async () => {
      (mockPrisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-both',
        status: 'in_progress',
      });

      (mockPrisma.request.update as jest.Mock).mockResolvedValue({
        id: 'req-both',
        title: 'Teste',
        description: 'Descrição',
        type: 'feature',
        status: 'review',
        prUrl: 'https://github.com/org/repo/pull/2',
        authorId: 'test-user-id',
        author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      (mockPrisma.requestEvent.create as jest.Mock).mockResolvedValue({});

      const res = await request(app)
        .patch('/requests/req-both')
        .set('Cookie', generateAuthCookie())
        .send({ status: 'review', prUrl: 'https://github.com/org/repo/pull/2' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('review');
      expect(res.body.data.prUrl).toBe('https://github.com/org/repo/pull/2');
    });

    it('deve retornar 400 quando prUrl é uma URL inválida', async () => {
      const res = await request(app)
        .patch('/requests/req-1')
        .set('Cookie', generateAuthCookie())
        .send({ prUrl: 'nao-e-uma-url' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Validação Zod - Schemas', () => {
  describe('registerSchema', () => {
    it('deve retornar erro de validação com body vazio', async () => {
      const res = await request(app).post('/auth/register').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve retornar erro de validação com campos de tipos errados', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 12345,
        name: true,
        password: [],
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve retornar erro de validação com nome de 1 caractere (abaixo do mínimo de 2)', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'valido@devportal.local',
        name: 'A',
        password: 'SenhaForte123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve retornar erro de validação com senha de 7 caracteres (boundary - deve falhar)', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'valido@devportal.local',
        name: 'Nome Válido',
        password: '1234567',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve aceitar senha com exatamente 8 caracteres (boundary - deve passar)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'boundary-user',
        email: 'boundary@devportal.local',
        name: 'Boundary User',
        passwordHash: 'hashed',
        createdAt: new Date(),
      });

      const res = await request(app).post('/auth/register').send({
        email: 'boundary@devportal.local',
        name: 'Boundary User',
        password: '12345678',
      });

      expect(res.status).toBe(201);
    });
  });

  describe('updateRequestSchema', () => {
    it('deve retornar erro de validação quando prUrl é URL inválida', async () => {
      const JWT_SECRET_LOCAL = process.env.JWT_SECRET || 'devportal-jwt-secret-change-in-production';
      const token = jwt.sign({ userId: 'test-user-id', email: 'test@devportal.local' }, JWT_SECRET_LOCAL, {
        expiresIn: '1h',
      });

      const res = await request(app)
        .patch('/requests/req-1')
        .set('Cookie', `token=${token}`)
        .send({ prUrl: 'url-invalida' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('deve aceitar body vazio (ambos campos são opcionais)', async () => {
      const JWT_SECRET_LOCAL = process.env.JWT_SECRET || 'devportal-jwt-secret-change-in-production';
      const token = jwt.sign({ userId: 'test-user-id', email: 'test@devportal.local' }, JWT_SECRET_LOCAL, {
        expiresIn: '1h',
      });

      (prisma.request.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: 'pending',
      });

      (prisma.request.update as jest.Mock).mockResolvedValue({
        id: 'req-1',
        title: 'Teste',
        description: 'Descrição',
        type: 'bug_fix',
        status: 'pending',
        authorId: 'test-user-id',
        author: { id: 'test-user-id', email: 'test@devportal.local', name: 'Test' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .patch('/requests/req-1')
        .set('Cookie', `token=${token}`)
        .send({});

      expect(res.status).toBe(200);
    });
  });
});
