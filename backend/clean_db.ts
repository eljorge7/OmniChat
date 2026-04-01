import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const allCompanies = await p.company.findMany();
  for (const c of allCompanies) {
    if (!c.name.toLowerCase().includes('hurtado')) {
       console.log(`Deleting cascades for company: ${c.name}`);
       await p.message.deleteMany({ where: { contact: { companyId: c.id } } });
       await p.contactNote.deleteMany({ where: { contact: { companyId: c.id } } });
       await p.contact.deleteMany({ where: { companyId: c.id } });
       await p.pipeline.deleteMany({ where: { companyId: c.id } });
       await p.company.delete({ where: { id: c.id } });
       console.log(`Deleted company: ${c.name}`);
    }
  }
}
main().catch(console.error).finally(() => p.$disconnect());
