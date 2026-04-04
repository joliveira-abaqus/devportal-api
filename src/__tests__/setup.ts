import dotenv from 'dotenv';
dotenv.config();

// Configura variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://devportal:devportal@localhost:5432/devportal_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
