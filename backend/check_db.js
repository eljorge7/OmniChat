const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function check() {
  console.log("=== CHECKING UPLOADS FOLDER ===");
  try {
    const files = fs.readdirSync('./uploads');
    console.log("FILES IN UPLOADS:", files);
  } catch (e) {
    console.log("No uploads folder or error:", e.message);
  }

  console.log("\n=== CHECKING LATEST MESSAGES ===");
  const prisma = new PrismaClient();
  try {
    const msgs = await prisma.message.findMany({
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    console.log(msgs.map(m => `[${m.id}] hasMediaUrl: ${!!m.mediaUrl} | ext: ${m.mediaType} | body: ${m.body}`).join('\n'));
  } catch (e) {
    console.error("PRISMA ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
