import request from 'supertest';
import app from '../src/app';
import prisma from '../src/config/database';
import redis from '../src/config/redis';

const TEST_USER = {
  email: 'dev@devportal.local',
  password: 'DevPortal123!',
};

describe('E2E: Fluxo completo de solicitações', () => {
  let authCookie: string;

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  it('deve verificar que o health check está funcionando', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data.api).toBe('ok');
  });

  it('deve fazer login com o usuário de teste', async () => {
    const res = await request(app).post('/auth/login').send(TEST_USER);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.email).toBe(TEST_USER.email);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    authCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  });

  it('deve criar uma nova solicitação', async () => {
    const res = await request(app)
      .post('/requests')
      .set('Cookie', authCookie)
      .send({
        title: 'Corrigir bug no login',
        description: 'O botão de login não responde ao clicar em dispositivos mobile.',
        type: 'bug_fix',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.status).toBe('pending');
  });

  it('deve listar solicitações', async () => {
    const res = await request(app)
      .get('/requests')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('deve obter detalhes de uma solicitação', async () => {
    const listRes = await request(app)
      .get('/requests')
      .set('Cookie', authCookie);

    const requestId = listRes.body.data[0].id;

    const res = await request(app)
      .get(`/requests/${requestId}`)
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(requestId);
    expect(res.body.data).toHaveProperty('events');
  });

  it('deve atualizar o status de uma solicitação', async () => {
    const listRes = await request(app)
      .get('/requests')
      .set('Cookie', authCookie);

    const requestId = listRes.body.data[0].id;

    const res = await request(app)
      .patch(`/requests/${requestId}`)
      .set('Cookie', authCookie)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('deve rejeitar transição de status inválida', async () => {
    const listRes = await request(app)
      .get('/requests')
      .set('Cookie', authCookie);

    const requestId = listRes.body.data[0].id;

    const res = await request(app)
      .patch(`/requests/${requestId}`)
      .set('Cookie', authCookie)
      .send({ status: 'pending' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('deve fazer logout', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
  });

  it('deve rejeitar acesso sem autenticação após logout', async () => {
    const res = await request(app).get('/requests');
    expect(res.status).toBe(401);
  });
});
