const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const contacts = await prisma.contact.findMany({ select: { id: true, phone: true, name: true } });
  console.log(JSON.stringify(contacts, null, 2));
}

test().catch(console.error).finally(() => prisma.$disconnect());
