import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('DevPortal123!', 10);

  await prisma.user.upsert({
    where: { email: 'dev@devportal.local' },
    update: {},
    create: {
      email: 'dev@devportal.local',
      name: 'Dev User',
      passwordHash,
    },
  });

  console.info('Seed concluído: usuário dev@devportal.local criado.');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
