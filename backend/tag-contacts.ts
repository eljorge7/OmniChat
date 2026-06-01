import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Iniciando etiquetado retroactivo de contactos por Rifa...");
  
  const raffles = await prisma.raffle.findMany({
    include: {
      tickets: {
        where: { contactId: { not: null } },
        select: { contactId: true }
      }
    }
  });

  let updatedCount = 0;

  for (const raffle of raffles) {
    const tagName = `Rifa: ${raffle.name}`;
    console.log(`Procesando Rifa: ${tagName}`);

    // Get unique contact IDs for this raffle
    const contactIds = Array.from(new Set(raffle.tickets.map(t => t.contactId).filter(id => id !== null))) as string[];
    
    for (const contactId of contactIds) {
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (contact) {
        const tagsToAdd = [];
        if (!contact.tags.includes('SORTEO')) tagsToAdd.push('SORTEO');
        if (!contact.tags.includes(tagName)) tagsToAdd.push(tagName);

        if (tagsToAdd.length > 0) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: { push: tagsToAdd } }
          });
          updatedCount++;
        }
      }
    }
  }

  console.log(`Se actualizaron ${updatedCount} contactos con sus etiquetas de rifa.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
