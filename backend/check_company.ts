import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.company.findMany().then(c => console.log(c.map(x => x.name))).catch(console.error).finally(() => p.$disconnect());
