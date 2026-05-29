import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RaffleService {
  private readonly logger = new Logger(RaffleService.name);

  constructor(private prisma: PrismaService) {}

  async findAllActive(companyId: string) {
    return this.prisma.raffle.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
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

  async reserveTickets(raffleId: string, ticketNumbers: string[], contactPhone: string, contactName: string) {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    // Clean phone number
    const phone = contactPhone.replace(/\D/g, '');

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
          botStatus: 'ACTIVE'
        }
      });
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
        },
        create: {
          raffleId,
          ticketNumber: num,
          status: 'RESERVED',
          contactId: contact.id,
          reservedAt: new Date(),
        }
      });
      reservations.push(ticket);
    }

    return {
      message: 'Boletos reservados con éxito',
      reservedTickets: ticketNumbers,
      totalAmount: ticketNumbers.length * raffle.ticketPrice,
      contact
    };
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
      await this.prisma.ticket.updateMany({
        where: {
          id: { in: expiredTickets.map(t => t.id) }
        },
        data: {
          status: 'AVAILABLE',
          contactId: null,
          reservedAt: null
        }
      });
      this.logger.log(`Se liberaron ${expiredTickets.length} boletos expirados.`);
    }
  }
}
