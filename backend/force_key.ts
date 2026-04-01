import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  await p.company.updateMany({
     where: { name: { contains: 'RJL' } },
     data: { apiKey: 'sk_rjl_obsolete_' + Date.now() }
  });
  await p.company.updateMany({
     where: { name: { contains: 'Hurtado' } },
     data: { apiKey: 'sk_24af03088b47aac20bae7b1df07f8399' }
  });
  console.log('API KEY MOVED TO GRUPO HURTADO');
}

main().catch(console.error).finally(() => p.$disconnect());
