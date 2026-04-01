const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.message.deleteMany();
  await prisma.contact.deleteMany();
  console.log('Mensajes y Contactos borrados exitosamente.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
