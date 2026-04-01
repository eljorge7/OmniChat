import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const companies = await p.company.findMany();
  console.log("== COMPANIES ==");
  for (const c of companies) {
    console.log(`- ${c.name}: Key? ${!!c.openAiKey}`);
  }
  const contacts = await p.contact.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log("== CONTACTS ==");
  for (const ct of contacts) {
    console.log(`- ${ct.name} (${ct.phone}): botStatus=${ct.botStatus}, pipelineId=${ct.pipelineId}`);
  }
}
main().finally(() => p.$disconnect());
