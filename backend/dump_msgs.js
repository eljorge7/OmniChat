const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Get messages from the last 2 days
    const recentMessages = await prisma.message.findMany({
        orderBy: { timestamp: 'desc' },
        take: 30,
        include: { contact: true }
    });
    
    // Reverse to chronological
    for (const m of recentMessages.reverse()) {
        console.log(`[${m.timestamp}] (${m.contact?.phone} - ${m.contact?.name}) FromMe: ${m.fromMe} | ${m.body.substring(0, 50)}`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
