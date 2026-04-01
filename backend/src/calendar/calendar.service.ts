import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Obtener todas las citas de un mes/rango para una empresa
   */
  async getEventsByCompany(companyId: string, startDate?: string, endDate?: string) {
    const whereClause: any = { companyId };
    
    // Si se envían fechas de inicio y fin (ideal para vistas de Calendario mensuales o semanales)
    if (startDate && endDate) {
      whereClause.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    return await this.prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true } }
      },
      orderBy: { startTime: 'asc' }
    });
  }

  /**
   * Crear una nueva cita
   */
  async createEvent(companyId: string, data: any) {
    this.logger.log(`Creando nueva cita para la compañía ${companyId}: ${data.title}`);
    
    return await this.prisma.calendarEvent.create({
      data: {
        companyId,
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status || 'SCHEDULED',
        contactId: data.contactId || null,
        assignedToId: data.assignedToId || null,
        pipelineId: data.pipelineId || null
      },
      include: {
        contact: true,
        assignedTo: true,
        pipeline: true
      }
    });
  }

  /**
   * Actualizar una cita existente
   */
  async updateEvent(eventId: string, companyId: string, data: any) {
    // Validar pertenencia
    const ev = await this.prisma.calendarEvent.findFirst({
       where: { id: eventId, companyId }
    });
    if(!ev) throw new NotFoundException('Cita no encontrada o acceso denegado.');

    return await this.prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title: data.title,
        description: data.description,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        status: data.status,
        assignedToId: data.assignedToId,
        pipelineId: data.pipelineId
      }
    });
  }

  /**
   * Eliminar cita
   */
  async deleteEvent(eventId: string, companyId: string) {
    const ev = await this.prisma.calendarEvent.findFirst({
       where: { id: eventId, companyId }
    });
    if(!ev) throw new NotFoundException('Cita no encontrada o acceso denegado.');

    return await this.prisma.calendarEvent.delete({
      where: { id: eventId }
    });
  }
}
