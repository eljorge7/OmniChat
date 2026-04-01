const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
    const key = 'sk_' + crypto.randomBytes(16).toString('hex');
    const c = await prisma.company.findFirst();
    if (c) {
       await prisma.company.update({
           where: { id: c.id },
           data: { apiKey: key }
       });
       console.log("===============================");
       console.log("NUEVA LLAVE MAESTRA CREADA (RJL)");
       console.log("API_KEY: " + key);
       console.log("===============================");
    }
}
main().finally(() => prisma.$disconnect());
