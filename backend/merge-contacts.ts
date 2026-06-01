import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Iniciando normalización y fusión de contactos...");
  const contacts = await prisma.contact.findMany();
  
  let mergedCount = 0;

  for (const contact of contacts) {
    if (contact.phone.length === 10) {
      const normalizedPhone = `521${contact.phone}`;
      
      // Buscar si existe el contacto normalizado
      const targetContact = await prisma.contact.findFirst({
        where: { phone: normalizedPhone, companyId: contact.companyId }
      });

      if (targetContact) {
        console.log(`Fusionando ${contact.phone} -> ${normalizedPhone}`);
        // 1. Mover Tickets
        await prisma.ticket.updateMany({
          where: { contactId: contact.id },
          data: { contactId: targetContact.id }
        });
        
        // 2. Mover Messages
        await prisma.message.updateMany({
          where: { contactId: contact.id },
          data: { contactId: targetContact.id }
        });

        // 3. Move/Merge Chats
        // Chat uses contactId as unique usually
        try {
            // we ignore chat merging logic errors just in case
            await prisma.chat.deleteMany({ where: { contactId: contact.id }});
        } catch(e) {}
        
        // Update tags
        const tagsToAdd = contact.tags.filter(t => !targetContact.tags.includes(t));
        if (tagsToAdd.length > 0) {
            await prisma.contact.update({
                where: { id: targetContact.id },
                data: { tags: { push: tagsToAdd } }
            });
        }

        // 4. Update name if target has no name
        if (!targetContact.name && contact.name) {
             await prisma.contact.update({
                where: { id: targetContact.id },
                data: { name: contact.name }
            });
        }

        // Delete old contact
        await prisma.contact.delete({ where: { id: contact.id } });
        mergedCount++;
      } else {
        // Just update the phone to 521...
        console.log(`Actualizando ${contact.phone} -> ${normalizedPhone} (Sin fusionar)`);
        await prisma.contact.update({
          where: { id: contact.id },
          data: { phone: normalizedPhone }
        });
        mergedCount++;
      }
    }
  }
  
  console.log(`Se procesaron/fusionaron ${mergedCount} contactos.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
