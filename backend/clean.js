const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    console.log('Buscando contactos corruptos...');
    const badContacts = await prisma.contact.findMany({ where: { phone: { contains: '@c.us' } } });
    console.log('Malos encontrados: ', badContacts.length);

    for (const c of badContacts) {
        const cleanPhone = c.phone.replace('@c.us', '');
        const existing = await prisma.contact.findFirst({ where: { phone: cleanPhone, companyId: c.companyId, id: { not: c.id } } });

        if (existing) {
            console.log('Fusionando con contacto existente...');
            await prisma.message.updateMany({ where: { contactId: c.id }, data: { contactId: existing.id } });
            await prisma.contactNote.updateMany({ where: { contactId: c.id }, data: { contactId: existing.id } });
            await prisma.contact.delete({ where: { id: c.id } });
        } else {
            console.log('Limpiando sufijo...');
            await prisma.contact.update({ where: { id: c.id }, data: { phone: cleanPhone } });
        }
    }
    console.log('Finalizado!');
}

clean().catch(console.error).finally(() => prisma.$disconnect());
