const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const d = await prisma.company.findFirst();
    console.log(d.openAiPrompt.substring(0, 500));
}
main();
