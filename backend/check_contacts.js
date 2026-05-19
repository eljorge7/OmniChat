const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const contacts = await prisma.contact.findMany({
        select: { id: true, phone: true, name: true, companyId: true },
        orderBy: { phone: 'asc' }
    });
    console.log("Contactos:", JSON.stringify(contacts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
