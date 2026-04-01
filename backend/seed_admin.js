const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (company) {
      const existing = await prisma.user.findFirst({ where: { email: 'admin@omnichat.com' } });
      if (!existing) {
          await prisma.user.create({
              data: {
                  email: 'admin@omnichat.com',
                  password: 'admin',
                  name: 'Jorge Hurtado (Admin)',
                  role: 'ADMIN',
                  companyId: company.id
              }
          });
          console.log('✅ Admin user created: admin@omnichat.com / admin');
      } else {
          console.log('✅ Admin user already exists.');
      }
  } else {
      console.log('❌ No company found to attach admin user.');
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
