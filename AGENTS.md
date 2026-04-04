# AGENTS.md - devportal-api

## Arquitetura

O **devportal-api** é o backend do DevPortal, uma plataforma simplificada tipo Jira com pipeline de resolução integrado. A aplicação é construída com:

- **Express.js** — Framework HTTP
- **TypeScript** — Tipagem estática
- **Prisma** — ORM para PostgreSQL
- **Redis (ioredis)** — Cache de listagens e invalidação no write
- **AWS S3** — Upload de arquivos anexados às solicitações (via LocalStack em dev)
- **AWS SQS** — Fila de processamento de solicitações (via LocalStack em dev)
- **Sentry** — Monitoramento de erros em produção

## Pré-requisitos

O backend depende dos serviços definidos no repositório `devportal-infra`. Antes de rodar localmente:

```bash
# No repositório devportal-infra
docker compose up -d
```

Isso sobe:
- **PostgreSQL** na porta 5432 (user: `devportal`, pass: `devportal`, db: `devportal`)
- **Redis** na porta 6379
- **LocalStack** na porta 4566 (bucket `devportal-attachments`, fila SQS `devportal-requests`)

## Como rodar localmente

```bash
# 1. Instalar dependências
npm ci

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Gerar o Prisma Client
npx prisma generate

# 4. Executar migrations
npx prisma migrate dev

# 5. Executar seed (cria usuário de teste)
npx prisma db seed

# 6. Iniciar o servidor de desenvolvimento
npm run dev
# Servidor rodando em http://localhost:3001

# 7. (Opcional) Iniciar o worker SQS
npm run worker
```

## Convenções de código

- **Linter:** ESLint com `@typescript-eslint`
- **Formatação:** Prettier (semi, singleQuote, trailingComma all)
- **Tipos:** Proibido uso de `any` — usar `unknown` com type guards
- **Retornos:** Todas as funções devem ter tipo de retorno explícito
- **Erros:** Nunca engolir erros silenciosamente. Sempre logar ou relançar
- **Respostas da API:** Formato `{ data: T }` ou `{ error: { message, code } }`

## Como rodar testes

```bash
# Testes unitários + integração
npm test

# Testes e2e (requer devportal-infra rodando)
npm run test:e2e

# Lint
npm run lint

# Build
npm run build
```

## Estrutura de pastas

```
src/
├── index.ts           # Entry point
├── app.ts             # Express config (middleware, rotas)
├── config/            # Configurações (Prisma, Redis, AWS)
├── routes/            # Definição de rotas
├── controllers/       # Handlers HTTP
├── services/          # Lógica de negócio
├── middleware/         # Auth, error handler, validação
├── workers/           # SQS consumer
└── __tests__/         # Testes unitários e integração
```

## Variáveis de ambiente

Veja `.env.example` para a lista completa. As principais são:

| Variável | Descrição | Default |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://devportal:devportal@localhost:5432/devportal` |
| `REDIS_URL` | Connection string Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Secret para assinar tokens JWT | (obrigatório em produção) |
| `AWS_ENDPOINT` | Endpoint AWS/LocalStack | `http://localhost:4566` |
| `PORT` | Porta do servidor | `3001` |
| `SENTRY_DSN` | DSN do Sentry | (opcional) |

## Modelos de dados

- **User** — Usuários do sistema (email, nome, passwordHash)
- **Request** — Solicitações (título, descrição, tipo, status, PR URL, anexo S3)
- **RequestEvent** — Eventos de uma solicitação (mudança de status, comentário, PR linkado)

## Status de uma solicitação

`pending` → `in_progress` → `review` → `done` ou `failed`

Transições inválidas são rejeitadas pela API com status 400.
