const { PrismaClient } = require('@prisma/client');
async function check() {
  const prisma = new PrismaClient();
  const msgs = await prisma.message.findMany({
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  console.log("=== OMNICHAT LATEST 5 MESSAGES ===");
  msgs.forEach(m => console.log(`${m.timestamp} | fromMe: ${m.fromMe} | ${m.body.substring(0, 50)}`));
  
  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 3
  });
  console.log("\n=== LATEST CONTACTS ===");
  contacts.forEach(c => console.log(`${c.phone} | ${c.name}`));
  
  await prisma.$disconnect();
}
check();
