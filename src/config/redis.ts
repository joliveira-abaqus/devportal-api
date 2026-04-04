import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 3) {
      console.error('Redis: número máximo de tentativas de reconexão atingido.');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => {
  console.error('Erro de conexão Redis:', err.message);
});

redis.on('connect', () => {
  console.info('Conectado ao Redis.');
});

export default redis;
