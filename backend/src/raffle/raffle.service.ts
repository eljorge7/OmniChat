import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TicketGeneratorService } from './ticket-generator.service';
import * as fs from 'fs';
import * as path from 'path';
import Stripe from 'stripe';

@Injectable()
export class RaffleService {
  private readonly logger = new Logger(RaffleService.name);

  constructor(
      private prisma: PrismaService,
      @Inject(forwardRef(() => WhatsappService)) private whatsapp: WhatsappService,
      private ticketGenerator: TicketGeneratorService
  ) {}

  async findAllActive(companyId: string) {
    return this.prisma.raffle.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { tickets: true }
    });
  }

  async findAllForAdmin(companyId: string) {
    return this.prisma.raffle.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { 
        tickets: {
          include: { contact: true }
        }
      }
    });
  }

  async findOne(id: string) {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id },
      include: { tickets: true }
    });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');
    
    // Transform tickets array into a map or just return them
    return raffle;
  }

  async create(companyId: string, data: any) {
    if (data.drawDate) data.drawDate = new Date(data.drawDate);
    return this.prisma.raffle.create({
      data: {
        ...data,
        companyId
      }
    });
  }

  async update(id: string, companyId: string, data: any) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id } });
    if (!raffle || raffle.companyId !== companyId) throw new NotFoundException('Rifa no encontrada');

    if (data.drawDate) data.drawDate = new Date(data.drawDate);

    return this.prisma.raffle.update({
      where: { id },
      data
    });
  }

  async remove(id: string, companyId: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id } });
    if (!raffle || raffle.companyId !== companyId) throw new NotFoundException('Rifa no encontrada');

    return this.prisma.raffle.delete({ where: { id } });
  }

  async updateTicketStatus(raffleId: string, ticketNumber: string, status: string, companyId: string, paymentReference?: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle || raffle.companyId !== companyId) throw new NotFoundException('Rifa no encontrada');

    // If status is AVAILABLE, we might want to delete the ticket record entirely to free it up
    if (status === 'AVAILABLE') {
      return this.prisma.ticket.deleteMany({
        where: { raffleId, ticketNumber }
      });
    }

    // Otherwise update or create it if someone manually assigns it
    const updatedTicket = await this.prisma.ticket.upsert({
      where: {
        raffleId_ticketNumber: {
          raffleId,
          ticketNumber
        }
      },
      update: { status, paymentReference },
      create: {
        raffleId,
        ticketNumber,
        status,
        paymentReference
      },
      include: { contact: true }
    });

    if (status === 'PAID' && updatedTicket.contactId) {
       // Generar Boleto Digital VIP
       const company = await this.prisma.company.findUnique({ where: { id: companyId } });
       if (company && updatedTicket.contact) {
          const imageBuffer = await this.ticketGenerator.generateTicket({
             companyName: company.name,
             raffleName: raffle.name,
             contactName: updatedTicket.contact.name || 'Participante',
             ticketNumbers: [ticketNumber],
             paymentRef: updatedTicket.paymentReference || 'N/A',
             themeColor: company.themeColor || '#3B82F6',
             logoUrl: company.logoUrl || undefined
          });

          if (imageBuffer) {
             const message = `🎟️ *¡Tu Pago ha sido Confirmado!*\n\nHola ${updatedTicket.contact.name}, gracias por tu compra. Adjunto tu *Boleto Digital VIP* oficial para la rifa "${raffle.name}".\n\nPor favor guarda esta imagen, es tu comprobante oficial de participación.\n¡Mucha suerte! 🍀`;
             const fs = require('fs');
             const path = require('path');
             const filename = `ticket-${raffleId}-${ticketNumber}.png`;
             const tmpPath = path.join('/tmp', filename);
             
             try {
                fs.writeFileSync(tmpPath, imageBuffer);
                await this.whatsapp.sendDirectMediaMessage(companyId, updatedTicket.contact.phone, tmpPath);
                await this.whatsapp.sendDirectMessage(companyId, updatedTicket.contact.phone, message);
                fs.unlinkSync(tmpPath);
                this.logger.log(`Boleto VIP enviado a ${updatedTicket.contact.phone}`);
             } catch(e) {
                this.logger.error("Error enviando boleto VIP por WA", e);
             }
          }
       }
    }

    return updatedTicket;
  }

  async registerTicketPayment(raffleId: string, ticketNumber: string, amount: number, companyId: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    const ticket = await this.prisma.ticket.findUnique({
      where: { raffleId_ticketNumber: { raffleId, ticketNumber } },
      include: { contact: true }
    });

    if (!ticket) throw new NotFoundException('Boleto no encontrado');

    const newAmountPaid = (ticket.amountPaid || 0) + amount;
    const isFullyPaid = newAmountPaid >= raffle.ticketPrice;
    
    const newStatus = isFullyPaid ? 'PAID' : 'PARTIALLY_PAID';

    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
        paidAt: isFullyPaid ? new Date() : ticket.paidAt
      },
      include: { contact: true }
    });

    if (isFullyPaid && updatedTicket.contact) {
        // Generar Boleto Digital VIP
        const company = await this.prisma.company.findUnique({ where: { id: companyId } });
        if (company) {
           const imageBuffer = await this.ticketGenerator.generateTicket({
              companyName: company.name,
              raffleName: raffle.name,
              contactName: updatedTicket.contact.name || 'Participante',
              ticketNumbers: [ticketNumber],
              paymentRef: updatedTicket.paymentReference || 'N/A',
              themeColor: company.themeColor || '#3B82F6',
              logoUrl: company.logoUrl || undefined
           });

           if (imageBuffer) {
              const message = `🎟️ *¡Tu Pago ha sido Confirmado!*\n\nHola ${updatedTicket.contact.name}, tu boleto ha sido liquidado exitosamente. Adjunto tu *Boleto Digital VIP* oficial para la rifa "${raffle.name}".\n\nPor favor guarda esta imagen, es tu comprobante oficial de participación.\n¡Mucha suerte! 🍀`;
              const fs = require('fs');
              const path = require('path');
              const filename = `ticket-${raffleId}-${ticketNumber}.png`;
              const tmpPath = path.join('/tmp', filename);
              
              try {
                 fs.writeFileSync(tmpPath, imageBuffer);
                 await this.whatsapp.sendDirectMediaMessage(companyId, updatedTicket.contact.phone, tmpPath, updatedTicket.contact.id);
                 await this.whatsapp.sendDirectMessage(companyId, updatedTicket.contact.phone, message, updatedTicket.contact.id);
                 fs.unlinkSync(tmpPath);
                 this.logger.log(`Boleto VIP enviado a ${updatedTicket.contact.phone}`);
              } catch(e) {
                 this.logger.error("Error enviando boleto VIP por WA", e);
              }
           }
        }
    } else if (!isFullyPaid && updatedTicket.contact) {
        // Enviar notificación de pago parcial
        const remaining = raffle.ticketPrice - newAmountPaid;
        const message = `💳 *¡Abono Recibido!*\n\nHola ${updatedTicket.contact.name}, hemos registrado exitosamente tu abono de *$${amount} MXN* para el boleto *${ticketNumber}*.\n\nLlevas pagado: *$${newAmountPaid} MXN*\nResta por pagar: *$${remaining} MXN*\n\nTu boleto está asegurado (Pagado Parcialmente) y no caducará. Por favor, liquida el saldo pendiente antes de la fecha límite para recibir tu Boleto Digital VIP.`;
        try {
            await this.whatsapp.sendDirectMessage(companyId, updatedTicket.contact.phone, message, updatedTicket.contact.id);
        } catch(e) {
            this.logger.error("Error enviando notificación de abono", e);
        }
    }

    return updatedTicket;
  }

  async registerTicketKitPayment(raffleId: string, ticketNumbers: string[], amount: number, companyId: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    const tickets = await this.prisma.ticket.findMany({
      where: { raffleId, ticketNumber: { in: ticketNumbers } },
      include: { contact: true }
    });

    if (tickets.length === 0) throw new NotFoundException('Boletos no encontrados');

    let remainingPayment = amount;
    const updatedTickets = [];

    for (const ticket of tickets) {
      const debt = raffle.ticketPrice - (ticket.amountPaid || 0);
      if (debt <= 0) {
        updatedTickets.push(ticket);
        continue;
      }

      const paymentToApply = Math.min(debt, remainingPayment);
      remainingPayment -= paymentToApply;

      const newAmountPaid = (ticket.amountPaid || 0) + paymentToApply;
      const isFullyPaid = newAmountPaid >= raffle.ticketPrice;

      const updated = await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          amountPaid: newAmountPaid,
          status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidAt: isFullyPaid && ticket.status !== 'PAID' ? new Date() : ticket.paidAt
        },
        include: { contact: true }
      });

      updatedTickets.push(updated);
    }

    // Calcular estado global del Kit
    const totalKitPrice = raffle.ticketPrice * tickets.length;
    const totalKitPaid = updatedTickets.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
    const isKitFullyPaid = updatedTickets.every(t => t.status === 'PAID');
    const contact = updatedTickets.find(t => t.contact)?.contact;

    if (!contact) return updatedTickets; // Si son ventas manuales sin contacto, terminamos aquí.

    if (isKitFullyPaid) {
      // Generar UN SOLO Boleto VIP para todo el Kit
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company) {
        const imageBuffer = await this.ticketGenerator.generateTicket({
          companyName: company.name,
          raffleName: raffle.name,
          contactName: contact.name || 'Participante',
          ticketNumbers: ticketNumbers, // Array completo
          paymentRef: updatedTickets[0]?.paymentReference || 'N/A',
          themeColor: company.themeColor || '#3B82F6',
          logoUrl: company.logoUrl || undefined
        });

        if (imageBuffer) {
          const message = `🎟️ *¡Tu Pago ha sido Confirmado!*\n\nHola ${contact.name}, los ${ticketNumbers.length} boletos de tu paquete han sido liquidados exitosamente. Adjunto tu *Boleto Digital VIP* oficial para la rifa "${raffle.name}".\n\nBoletos: ${ticketNumbers.join(', ')}\n\nPor favor guarda esta imagen, es tu comprobante oficial de participación.\n¡Mucha suerte! 🍀`;
          const fs = require('fs');
          const path = require('path');
          const filename = `ticket-kit-${raffleId}-${Date.now()}.png`;
          const tmpPath = path.join('/tmp', filename);
          
          try {
            fs.writeFileSync(tmpPath, imageBuffer);
            await this.whatsapp.sendDirectMediaMessage(companyId, contact.phone, tmpPath, contact.id);
            await this.whatsapp.sendDirectMessage(companyId, contact.phone, message, contact.id);
            fs.unlinkSync(tmpPath);
            this.logger.log(`Boleto VIP de Kit enviado a ${contact.phone}`);
          } catch(e) {
            this.logger.error("Error enviando boleto VIP de Kit por WA", e);
          }
        }
      }
    } else {
      // Notificación de abono parcial para el Kit
      const remaining = totalKitPrice - totalKitPaid;
      const message = `💳 *¡Abono a Paquete Recibido!*\n\nHola ${contact.name}, hemos registrado exitosamente tu abono de *$${amount} MXN* para tu paquete de ${ticketNumbers.length} boletos (${ticketNumbers.join(', ')}).\n\nLlevas pagado: *$${totalKitPaid} MXN*\nResta por pagar del paquete: *$${remaining} MXN*\n\nTus boletos están asegurados (Pagados Parcialmente). Por favor liquida el saldo restante antes de la fecha límite para recibir tu Boleto Digital VIP.`;
      
      try {
        await this.whatsapp.sendDirectMessage(companyId, contact.phone, message, contact.id);
      } catch(e) {
        this.logger.error("Error enviando notificación de abono de kit", e);
      }
    }

    return updatedTickets;
  }

  async secureTicketKit(raffleId: string, ticketNumbers: string[], companyId: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    await this.prisma.ticket.updateMany({
      where: { raffleId, ticketNumber: { in: ticketNumbers } },
      data: {
        status: 'PARTIALLY_PAID'
      }
    });

    return { message: 'Apartado asegurado exitosamente' };
  }

  async finishRaffle(raffleId: string, companyId: string, winningNumber: string, evidenceUrl: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle || raffle.companyId !== companyId) {
      throw new NotFoundException('Rifa no encontrada o sin permisos');
    }

    // Validación estricta del número ganador
    const paddedWinningNumber = String(winningNumber).padStart(String(raffle.totalTickets).length, '0');

    const winningTicket = await this.prisma.ticket.findFirst({
      where: {
        raffleId,
        ticketNumber: paddedWinningNumber,
      },
      include: { contact: true }
    });

    if (!winningTicket) {
      throw new BadRequestException(`El boleto ganador #${paddedWinningNumber} no fue apartado/comprado por nadie en esta rifa.`);
    }

    if (winningTicket.status !== 'PAID') {
      throw new BadRequestException(`No puedes finalizar el sorteo con el boleto #${winningNumber} porque su estado no es PAGADO (Actual: ${winningTicket.status}).`);
    }

    const updatedRaffle = await this.prisma.raffle.update({
      where: { id: raffleId },
      data: {
        status: 'FINISHED',
        winningNumber,
        evidenceUrl,
      }
    });

    // Enviar flyer masivo asíncronamente
    this.broadcastWinnerFlyer(raffleId, companyId, updatedRaffle, winningTicket).catch(e => {
        this.logger.error("Error en broadcast de flyer ganador", e);
    });

    return updatedRaffle;
  }

  private async broadcastWinnerFlyer(raffleId: string, companyId: string, raffle: any, winningTicket: any) {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) return;

      let evidenceToRender = raffle.evidenceUrl;
      try {
        // Parse filename and attempt local read to avoid Docker network/CORS issues for Puppeteer
        const urlParts = raffle.evidenceUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const localPath = path.join(process.cwd(), 'uploads', filename);
        
        if (fs.existsSync(localPath)) {
            let ext = path.extname(filename).replace('.', '').toLowerCase();
            if (ext === 'jpg') ext = 'jpeg';
            if (!ext) ext = 'png';
            const base64 = fs.readFileSync(localPath).toString('base64');
            evidenceToRender = `data:image/${ext};base64,${base64}`;
        }
      } catch (err) {
        this.logger.error("Could not read evidence locally, falling back to URL", err);
      }

      const flyerBuffer = await this.ticketGenerator.generateWinnerFlyer({
        companyName: company.name,
        raffleName: raffle.name,
        winningNumber: winningTicket.ticketNumber,
        winnerName: winningTicket.contact?.name || 'Un afortunado ganador',
        evidenceUrl: evidenceToRender,
        themeColor: company.themeColor || '#3B82F6',
        logoUrl: company.logoUrl || undefined
      });

      if (!flyerBuffer) return;

      const tmpPath = path.join(process.cwd(), `tmp-flyer-winner-${Date.now()}.png`);
      fs.writeFileSync(tmpPath, flyerBuffer);

      const tickets = await this.prisma.ticket.findMany({
        where: { raffleId, contactId: { not: null } },
        select: { contact: true }
      });
      
      const uniqueContacts = Array.from(new Map(tickets.map((t: any) => [t.contact.id, t.contact])).values()) as any[];

      const message = `🎉 *¡Tenemos Ganador!*\n\nLa rifa *${raffle.name}* ha finalizado.\n\nEl boleto ganador es el *#${winningTicket.ticketNumber}*.\n\nTe adjuntamos el Flyer Oficial y la evidencia del sorteo. ¡Muchas gracias por participar y mucha suerte para la próxima!`;

      for (const contact of uniqueContacts) {
        if (!contact.phone) continue;
        try {
          await this.whatsapp.sendDirectMediaMessage(companyId, contact.phone, tmpPath, contact.id);
          await this.whatsapp.sendDirectMessage(companyId, contact.phone, message, contact.id);
          await new Promise(res => setTimeout(res, 2000)); // Rate limiting
        } catch (err) {
          this.logger.error(`Error enviando flyer a ${contact.phone}`, err);
        }
      }

      fs.unlinkSync(tmpPath);
    } catch(err) {
      this.logger.error("Broadcast flyer catch block", err);
    }
  }

  async reserveTickets(raffleId: string, ticketNumbers: string[], contactPhone: string, contactName: string) {
    const raffle = await this.prisma.raffle.findUnique({ 
        where: { id: raffleId },
        include: { company: true }
    });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    // Clean phone number
    let phone = contactPhone.replace(/\D/g, '');
    if (phone.length === 10) {
        phone = `521${phone}`;
    } else if (phone.length === 12 && phone.startsWith('52')) {
        phone = `521${phone.slice(2)}`;
    }

    // Get or Create Contact
    let contact = await this.prisma.contact.findFirst({
      where: { phone, companyId: raffle.companyId }
    });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          phone,
          name: contactName,
          companyId: raffle.companyId,
          botStatus: 'ACTIVE',
          tags: ['SORTEO', `Rifa: ${raffle.name}`]
        }
      });
    } else {
      const tagsToAdd = [];
      if (!contact.tags.includes('SORTEO')) tagsToAdd.push('SORTEO');
      if (!contact.tags.includes(`Rifa: ${raffle.name}`)) tagsToAdd.push(`Rifa: ${raffle.name}`);
      
      const updateData: any = {};
      if (tagsToAdd.length > 0) updateData.tags = { push: tagsToAdd };
      if (contact.name !== contactName) updateData.name = contactName;
      
      if (Object.keys(updateData).length > 0) {
        contact = await this.prisma.contact.update({
          where: { id: contact.id },
          data: updateData
        });
      }
    }

    // Check availability
    const existingTickets = await this.prisma.ticket.findMany({
      where: {
        raffleId,
        ticketNumber: { in: ticketNumbers }
      }
    });

    const unavailable = existingTickets.filter(t => t.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      throw new BadRequestException(`Algunos boletos ya no están disponibles: ${unavailable.map(t => t.ticketNumber).join(', ')}`);
    }

    // Generate Payment Reference
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const paymentReference = `REF-${randomSuffix}`;

    // Process reservations (Upsert to handle new creations or updates of AVAILABLE ones)
    const reservations = [];
    for (const num of ticketNumbers) {
      const ticket = await this.prisma.ticket.upsert({
        where: {
          raffleId_ticketNumber: {
            raffleId,
            ticketNumber: num
          }
        },
        update: {
          status: 'RESERVED',
          contactId: contact.id,
          reservedAt: new Date(),
          paymentReference
        },
        create: {
          raffleId,
          ticketNumber: num,
          status: 'RESERVED',
          contactId: contact.id,
          reservedAt: new Date(),
          paymentReference
        }
      });
      reservations.push(ticket);
    }

    // Send automatic WhatsApp notification
    const totalAmount = ticketNumbers.length * raffle.ticketPrice;
    
    let paymentMessage = `\n💰 *Total a pagar:* $${totalAmount.toFixed(2)} MXN.\n\n🏦 *DATOS DE PAGO:*\n- Banco: *Banorte*\n- CLABE: *072762006567799946*\n- A nombre de: *Jorge Hurtado Cota*\n- Concepto / Referencia: *${paymentReference}*\n\nPor favor, responde a este mensaje enviando la FOTO de tu comprobante de pago para que te confirme.`;
    
    if (raffle.company.stripeSecretKey) {
        const checkoutUrl = `https://api.omnichat.radiotecpro.com/api/v1/payments/pay/${paymentReference}`;
        paymentMessage = `\n💰 *Total a pagar:* $${totalAmount.toFixed(2)} MXN.\n\n💳 *PAGA EN LÍNEA (Tarjeta u Oxxo):*\n👉 Da clic aquí para pagar automáticamente y asegurar tus boletos:\n${checkoutUrl}`;
    }

    const notificationMessage = `🎟️ *¡Boletos Reservados!*\nHola ${contactName}, apartamos exitosamente tus boletos: *${ticketNumbers.join(', ')}* para la rifa "${raffle.name}".${paymentMessage}\n\n⚠️ *IMPORTANTE:* Cuentas con 12 horas para liquidar, de lo contrario se liberarán automáticamente.\n\nLink de la Rifa: https://omnichat.radiotecpro.com/rifas/${raffle.companyId}/${raffle.id}`;
    
    try {
        await this.whatsapp.sendDirectMessage(raffle.companyId, `${phone}@c.us`, notificationMessage);
    } catch(err) {
        this.logger.error("No se pudo enviar notificacion whatsapp de reserva", err);
    }

    return {
      message: 'Boletos reservados con éxito',
      reservedTickets: ticketNumbers,
      totalAmount: ticketNumbers.length * raffle.ticketPrice,
      contact,
      paymentReference
    };
  }

  async generateAvailableNumbersFlyer(raffleId: string): Promise<Buffer | null> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: { company: true, tickets: true }
    });

    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    // Identificar números disponibles
    const allNumbers = Array.from({ length: raffle.totalTickets }, (_, i) => i.toString().padStart(raffle.totalTickets.toString().length, '0'));
    const reservedOrPaid = new Set(raffle.tickets.filter(t => t.status !== 'AVAILABLE').map(t => t.ticketNumber));
    const availableNumbers = allNumbers.filter(n => !reservedOrPaid.has(n));

    return this.ticketGenerator.generateAvailableNumbersFlyer({
      companyName: raffle.company.name,
      raffleName: raffle.name,
      availableNumbers,
      themeColor: raffle.company.themeColor || '#3B82F6',
      logoUrl: raffle.company.logoUrl || undefined
    });
  }

  // Cronjob to release tickets unpaid after 12 hours
  @Cron(CronExpression.EVERY_HOUR)
  async releaseExpiredTickets() {
    this.logger.log('Ejecutando limpieza de boletos expirados (12 horas)...');
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const expiredTickets = await this.prisma.ticket.findMany({
      where: {
        status: 'RESERVED',
        reservedAt: { lt: twelveHoursAgo }
      }
    });

    if (expiredTickets.length > 0) {
      await this.prisma.ticket.deleteMany({
        where: {
          id: { in: expiredTickets.map(t => t.id) }
        }
      });
      this.logger.log(`Se liberaron ${expiredTickets.length} boletos expirados.`);
    }
  }
}
