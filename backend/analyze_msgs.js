const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const contacts = await prisma.contact.findMany({
        where: { phone: { in: ['5216421644126', '5216421093287'] } },
        include: {
            messages: { orderBy: { timestamp: 'asc' } }
        }
    });
    
    for (const c of contacts) {
        console.log(`\n\n=== CONTACTO: ${c.phone} | NOME: ${c.name} | COMPANY: ${c.companyId} ===`);
        for (const m of c.messages) {
            console.log(`[${m.timestamp}] FromMe: ${m.fromMe} | ${m.body.substring(0, 50)}`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
