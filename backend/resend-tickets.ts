import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PrismaService } from './src/prisma/prisma.service';
import { TicketGeneratorService } from './src/raffle/ticket-generator.service';
import { WhatsappService } from './src/whatsapp/whatsapp.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const ticketGenerator = app.get(TicketGeneratorService);
  const whatsapp = app.get(WhatsappService);

  // 1. Encuentra la rifa por ID exacto
  const raffle = await prisma.raffle.findUnique({
    where: { id: '2b84e3b3-1a65-4620-a3bb-e79d5e025767' },
    include: { company: true }
  });

  if (!raffle) {
    console.log('No se encontró la rifa de paneles');
    await app.close();
    return;
  }

  console.log(`Actualizando Rifa: ${raffle.name}`);

  // 2. Establecer el multiplier en 5
  await prisma.raffle.update({
    where: { id: raffle.id },
    data: { opportunitiesMultiplier: 5 }
  });
  
  raffle.opportunitiesMultiplier = 5;

  // 3. Obtener todos los boletos pagados
  const paidTickets = await prisma.ticket.findMany({
    where: { 
      raffleId: raffle.id, 
      status: 'PAID',
      contactId: { not: null }
    },
    include: { contact: true }
  });

  console.log(`Encontrados ${paidTickets.length} boletos pagados para reenviar.`);

  const expandTicketNumbers = (ticketNumbers: string[], totalTickets: number, multiplier: number): string[] => {
    if (!multiplier || multiplier <= 1) return ticketNumbers;
    const expanded = [];
    for (const t of ticketNumbers) {
      expanded.push(t);
      const num = parseInt(t, 10);
      for (let i = 1; i < multiplier; i++) {
        expanded.push(String(num + (totalTickets * i)).padStart(t.length, '0'));
      }
    }
    return expanded;
  };

  // Enviar a cada uno su boleto actualizado
  for (const ticket of paidTickets) {
    if (!ticket.contact || !ticket.contact.phone) continue;

    const expandedNumbers = expandTicketNumbers([ticket.ticketNumber], raffle.totalTickets, raffle.opportunitiesMultiplier);
    
    console.log(`Generando nuevo boleto VIP para ${ticket.contact.name} con números: ${expandedNumbers.join(', ')}`);

    const imageBuffer = await ticketGenerator.generateTicket({
      companyName: raffle.company.name,
      raffleName: raffle.name,
      contactName: ticket.contact.name || 'Participante',
      ticketNumbers: expandedNumbers,
      paymentRef: ticket.paymentReference || 'N/A',
      themeColor: raffle.company.themeColor || '#3B82F6',
      logoUrl: raffle.company.logoUrl || undefined
    });

    if (imageBuffer) {
      const message = `🎉 *¡ACTUALIZACIÓN DE TUS BOLETOS!*\n\nHola ${ticket.contact.name}, para aumentar tus probabilidades de ganar y darte más valor por tu compra, ¡hemos implementado **5 Oportunidades por Boleto**!\n\nTu boleto ${ticket.ticketNumber} ahora incluye automáticamente estas oportunidades: *${expandedNumbers.join(', ')}*\n\nAdjunto tu *NUEVO Boleto Digital VIP* oficial actualizado. ¡Te deseamos muchísima suerte! 🍀`;
      
      const filename = `ticket-update-${raffle.id}-${ticket.ticketNumber}.png`;
      const tmpPath = path.join('/tmp', filename);
      
      try {
        if (!fs.existsSync('/tmp')) fs.mkdirSync('/tmp');
        fs.writeFileSync(tmpPath, imageBuffer);
        await whatsapp.sendDirectMediaMessage(raffle.companyId, ticket.contact.phone, tmpPath);
        await whatsapp.sendDirectMessage(raffle.companyId, ticket.contact.phone, message);
        fs.unlinkSync(tmpPath);
        console.log(`✅ Nuevo Boleto VIP enviado con éxito a ${ticket.contact.name} (${ticket.contact.phone})`);
        
        // Rate limiting para no saturar WhatsApp
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch(e) {
        console.error(`❌ Error enviando a ${ticket.contact.phone}`, e);
      }
    }
  }

  console.log('✅ Proceso de actualización finalizado.');
  await app.close();
}

bootstrap();
