import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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

    it('deve fazer login com sucesso e setar cookie token', async () => {
      const hashedPassword = await bcrypt.hash('SenhaForte123!', 10);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-login-id',
        email: 'login@devportal.local',
        name: 'Login User',
        passwordHash: hashedPassword,
        createdAt: new Date(),
      });

      const res = await request(app).post('/auth/login').send({
        email: 'login@devportal.local',
        password: 'SenhaForte123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('id', 'user-login-id');
      expect(res.body.data).toHaveProperty('email', 'login@devportal.local');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('token=');
    });

    it('deve retornar 401 com senha incorreta', async () => {
      const hashedPassword = await bcrypt.hash('SenhaCorreta123!', 10);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-wrong-pass',
        email: 'user@devportal.local',
        name: 'User',
        passwordHash: hashedPassword,
        createdAt: new Date(),
      });

      const res = await request(app).post('/auth/login').send({
        email: 'user@devportal.local',
        password: 'SenhaErrada123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
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

describe('Auth Middleware', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

  it('deve retornar 401 quando não há cookie token', async () => {
    const res = await request(app).get('/requests');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('deve retornar 401 quando o token está expirado', async () => {
    const expiredToken = jwt.sign(
      { userId: 'user-id', email: 'test@devportal.local' },
      JWT_SECRET,
      { expiresIn: '0s' },
    );

    const res = await request(app)
      .get('/requests')
      .set('Cookie', `token=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('deve retornar 401 quando o token tem assinatura inválida (JWT_SECRET diferente)', async () => {
    const invalidToken = jwt.sign(
      { userId: 'user-id', email: 'test@devportal.local' },
      'secret-diferente-invalida',
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/requests')
      .set('Cookie', `token=${invalidToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('deve retornar 401 quando o token é malformado (string aleatória)', async () => {
    const res = await request(app)
      .get('/requests')
      .set('Cookie', 'token=string-aleatoria-nao-jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
