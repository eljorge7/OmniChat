const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
async function fixOmniChat() {
  const prisma = new PrismaClient({datasources: {db: {url: 'postgresql://rentadmin:admin123@localhost:5432/omnichat?schema=public'}}});
  const hashedPassword = await bcrypt.hash('R@diotec', 10);
  await prisma.user.update({
    where: { email: 'eljorge7@gmail.com' },
    data: { password: hashedPassword }
  });
  console.log("OmniChat password updated");
  await prisma.$disconnect();
}
fixOmniChat().catch(console.error);
