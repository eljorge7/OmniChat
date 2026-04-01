const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.message.findMany({ 
  where: { fromMe: true }, 
  include: { contact: true }, 
  orderBy: { timestamp: 'desc' }, 
  take: 3 
}).then(console.dir).finally(() => prisma.$disconnect());
