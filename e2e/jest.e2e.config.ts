import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
};

export default config;
