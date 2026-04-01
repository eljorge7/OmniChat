import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.company.findMany({ select: { name: true, openAiKey: true } })
  .then(c => console.log(JSON.stringify(c, null, 2)))
  .catch(console.error)
  .finally(() => p.$disconnect());
