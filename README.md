# devportal-api

Backend API for DevPortal — a simplified Jira with integrated resolution pipeline.

## Stack

- **Runtime:** Node.js 20 + Express + TypeScript
- **ORM:** Prisma + PostgreSQL
- **Cache:** Redis (ioredis)
- **Cloud:** AWS S3 + SQS (LocalStack for dev)
- **Monitoring:** Sentry

## Quick Start

```bash
# Pré-requisito: devportal-infra rodando (docker compose up -d)

npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev        # http://localhost:3001
```

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com hot-reload |
| `npm run build` | Build TypeScript → dist/ |
| `npm start` | Inicia o servidor em produção |
| `npm run worker` | Inicia o worker SQS |
| `npm run lint` | Executa ESLint |
| `npm test` | Testes unitários + integração |
| `npm run test:e2e` | Testes end-to-end |

## API Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/health` | Não | Health check |
| POST | `/auth/register` | Não | Registrar usuário |
| POST | `/auth/login` | Não | Login (retorna cookie JWT) |
| POST | `/auth/logout` | Não | Logout (limpa cookie) |
| GET | `/requests` | Sim | Listar solicitações (cursor-based) |
| POST | `/requests` | Sim | Criar solicitação |
| GET | `/requests/:id` | Sim | Detalhe da solicitação |
| PATCH | `/requests/:id` | Sim | Atualizar solicitação |

## Documentação

- [AGENTS.md](./AGENTS.md) — Arquitetura e convenções
- [REVIEW.md](./REVIEW.md) — Regras de code review
- [SKILL.md](./SKILL.md) — Skills para automação
