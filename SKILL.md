# @skills:run-tests

## Description
Run the full test suite for devportal-api including unit and e2e tests.

## Steps
1. Ensure devportal-infra Docker Compose is running (PostgreSQL, Redis, LocalStack)
2. Run `npx prisma migrate deploy` to ensure DB is up to date
3. Run `npx prisma db seed` to seed test data
4. Run `npm run test` for unit + integration tests
5. Run `npm run test:e2e` for end-to-end tests
6. Report results with pass/fail counts
