# Review Rules

## Security
- NEVER commit secrets, API keys, or passwords in code. Use environment variables.
- All endpoints except /health and /auth/* MUST use auth middleware.
- SQL queries MUST use Prisma (no raw SQL without explicit justification).

## Code Quality
- All functions must have TypeScript return types explicitly declared.
- Error handling: never swallow errors silently. Always log or rethrow.
- No `any` type usage — use `unknown` and narrow with type guards.

## API Conventions
- All responses must follow format: { data: T } or { error: { message: string, code: string } }
- Status codes: 200 (success), 201 (created), 400 (validation), 401 (unauth), 404 (not found), 500 (server error)
- Pagination: use cursor-based pagination for list endpoints.

## Testing
- Every new endpoint must have at least one integration test.
- Mocks must be used for external services (S3, SQS) in unit tests.
