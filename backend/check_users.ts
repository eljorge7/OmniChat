import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.findMany().then(u => console.log(JSON.stringify(u, null, 2)))
 .catch(console.error)
 .finally(() => p.$disconnect());
