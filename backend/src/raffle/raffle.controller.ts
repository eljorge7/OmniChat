import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { RaffleService } from './raffle.service';

@Controller('api/v1/raffles')
export class RaffleController {
  constructor(private readonly raffleService: RaffleService) {}

  @Get('company/:companyId')
  async getActiveRaffles(@Param('companyId') companyId: string) {
    return this.raffleService.findAllActive(companyId);
  }

  @Get(':id')
  async getRaffleDetail(@Param('id') id: string) {
    return this.raffleService.findOne(id);
  }

  @Post(':id/reserve')
  async reserveTickets(
    @Param('id') id: string,
    @Body() body: { ticketNumbers: string[], contactPhone: string, contactName: string }
  ) {
    return this.raffleService.reserveTickets(id, body.ticketNumbers, body.contactPhone, body.contactName);
  }

  // --- ADMIN ENDPOINTS ---
  @Get('admin/company/:companyId')
  async getAllRafflesForAdmin(@Param('companyId') companyId: string) {
    return this.raffleService.findAllForAdmin(companyId);
  }

  @Post()
  async createRaffle(@Body() body: any) {
    // En un entorno real se extraería companyId del JWT o Request
    const { companyId, ...data } = body;
    return this.raffleService.create(companyId, data);
  }

  @Put(':id')
  async updateRaffle(@Param('id') id: string, @Body() body: any) {
    const { companyId, ...data } = body;
    return this.raffleService.update(id, companyId, data);
  }

  @Delete(':id')
  async deleteRaffle(@Param('id') id: string, @Body() body: { companyId: string }) {
    return this.raffleService.remove(id, body.companyId);
  }

  @Put(':id/tickets/:ticketNumber')
  async updateTicketStatus(
    @Param('id') id: string,
    @Param('ticketNumber') ticketNumber: string,
    @Body() body: { companyId: string; status: string; paymentReference?: string }
  ) {
    return this.raffleService.updateTicketStatus(id, ticketNumber, body.status, body.companyId, body.paymentReference);
  }
}
