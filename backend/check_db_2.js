const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function debugLinks() {
  const prisma = new PrismaClient();
  try {
    const msgs = await prisma.message.findMany({
      where: { mediaUrl: { not: null } },
      orderBy: { timestamp: 'desc' },
      take: 3
    });
    
    console.log("=== ÚLTIMOS MENSAJES CON MEDIA ===");
    for (const m of msgs) {
       console.log(`URL DB: ${m.mediaUrl}`);
       
       const filename = m.mediaUrl.split('/').pop();
       const exists = fs.existsSync(`./uploads/${filename}`);
       console.log(`¿Existe ./uploads/${filename} físicamente?: ${exists}`);
    }
    
    console.log("\n=== CONTENIDO DEL FOLDER UPLOADS ===");
    console.log(fs.readdirSync('./uploads'));
  } catch(e) {
    console.error(e);
  } finally {
    prisma.$disconnect();
  }
}

debugLinks();
