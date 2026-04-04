import request from 'supertest';
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

describe('Auth Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('deve registrar um novo usuário com sucesso', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue({
        id: 'test-uuid',
        email: 'novo@devportal.local',
        name: 'Novo Usuário',
        passwordHash: 'hashed',
        createdAt: new Date(),
      });

      const res = await request(app).post('/auth/register').send({
        email: 'novo@devportal.local',
        name: 'Novo Usuário',
        password: 'SenhaForte123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.email).toBe('novo@devportal.local');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('deve retornar 400 se o email já existe', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-uuid',
        email: 'existente@devportal.local',
      });

      const res = await request(app).post('/auth/register').send({
        email: 'existente@devportal.local',
        name: 'Existente',
        password: 'SenhaForte123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('deve retornar 400 se dados de validação são inválidos', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'invalido',
        name: 'A',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    it('deve retornar 401 se usuário não existe', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app).post('/auth/login').send({
        email: 'inexistente@devportal.local',
        password: 'SenhaForte123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('deve retornar 400 se email inválido', async () => {
      const res = await request(app).post('/auth/login').send({
        email: 'invalido',
        password: 'SenhaForte123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/logout', () => {
    it('deve limpar o cookie e retornar sucesso', async () => {
      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Logout realizado com sucesso.');
    });
  });
});
