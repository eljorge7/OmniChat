const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const messages = await prisma.message.findMany({
    where: {
      body: { contains: 'apartamos exitosamente tus boletos' },
      fromMe: true
    },
    include: { contact: true }
  });

  let fixed = 0;
  for (const msg of messages) {
    const match = msg.body.match(/Hola (.*?), apartamos exitosamente tus boletos/);
    if (match && match[1]) {
      const realName = match[1];
      const contact = msg.contact;
      
      if (contact && (contact.name === 'Nuevo Lead' || contact.name === 'Contacto Sincronizado' || contact.name.toLowerCase().includes('wisphub'))) {
         await prisma.contact.update({
           where: { id: contact.id },
           data: { name: realName }
         });
         console.log(`Updated contact ${contact.phone} from "${contact.name}" to "${realName}"`);
         fixed++;
      }
    }
  }
  console.log(`Finished fixing ${fixed} contacts.`);
}
run();
