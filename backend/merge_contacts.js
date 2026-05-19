const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando fusión de contactos duplicados...");
    
    // Find all contacts that have '@c.us' in their phone
    const badContacts = await prisma.contact.findMany({
        where: { phone: { endsWith: '@c.us' } }
    });

    console.log(`Encontrados ${badContacts.length} contactos con '@c.us'`);

    for (const badContact of badContacts) {
        const cleanPhone = badContact.phone.replace('@c.us', '');
        
        // Find the good contact
        const goodContact = await prisma.contact.findFirst({
            where: { phone: cleanPhone, companyId: badContact.companyId, id: { not: badContact.id } }
        });

        if (goodContact) {
            console.log(`Fusionando: ${badContact.phone} -> ${goodContact.phone}`);
            
            // Move messages
            await prisma.message.updateMany({
                where: { contactId: badContact.id },
                data: { contactId: goodContact.id }
            });

            // Move notes
            await prisma.contactNote.updateMany({
                where: { contactId: badContact.id },
                data: { contactId: goodContact.id }
            });

            // Move events
            await prisma.calendarEvent.updateMany({
                where: { contactId: badContact.id },
                data: { contactId: goodContact.id }
            });
            
            // Move NPS
            await prisma.npsSurvey.updateMany({
                where: { contactId: badContact.id },
                data: { contactId: goodContact.id }
            });

            // Update goodContact unread count
            if (badContact.unreadCount > 0) {
                await prisma.contact.update({
                    where: { id: goodContact.id },
                    data: { unreadCount: { increment: badContact.unreadCount } }
                });
            }

            // Delete the bad contact
            await prisma.contact.delete({ where: { id: badContact.id } });
            console.log(`Contacto ${badContact.id} fusionado y eliminado.`);
        } else {
            // No duplicate exists, just clean the phone
            console.log(`No hay duplicado para ${badContact.phone}. Solo limpiando el número...`);
            try {
                await prisma.contact.update({
                    where: { id: badContact.id },
                    data: { phone: cleanPhone }
                });
            } catch (e) {
                console.error(`Error actualizando ${badContact.phone}:`, e.message);
            }
        }
    }
    
    console.log("Fusión completada.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
