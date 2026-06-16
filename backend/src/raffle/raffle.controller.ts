import { Controller, Get, Post, Put, Delete, Body, Param, Res } from '@nestjs/common';
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

  @Get(':id/flyer')
  async generateFlyer(@Param('id') id: string, @Res() res: any) {
    const buffer = await this.raffleService.generateAvailableNumbersFlyer(id);
    if (!buffer) {
      return res.status(500).json({ error: 'No se pudo generar el flyer' });
    }
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="numeros_disponibles_${id}.png"`);
    return res.send(buffer);
  }

  @Post(':id/reserve')
  async reserveTickets(
    @Param('id') id: string,
    @Body() body: { ticketNumbers: string[], contactPhone: string, contactName: string, sellerId?: string }
  ) {
    return this.raffleService.reserveTickets(id, body.ticketNumbers, body.contactPhone, body.contactName, body.sellerId);
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

  @Post(':id/tickets/:ticketNumber/pay')
  async registerTicketPayment(
    @Param('id') id: string,
    @Param('ticketNumber') ticketNumber: string,
    @Body() body: { companyId: string; amount: number }
  ) {
    return this.raffleService.registerTicketPayment(id, ticketNumber, body.amount, body.companyId);
  }

  @Post(':id/tickets/kit-pay')
  async registerTicketKitPayment(
    @Param('id') id: string,
    @Body() body: { companyId: string; ticketNumbers: string[]; amount: number }
  ) {
    return this.raffleService.registerTicketKitPayment(id, body.ticketNumbers, body.amount, body.companyId);
  }

  @Post(':id/tickets/kit-secure')
  async secureTicketKit(
    @Param('id') id: string,
    @Body() body: { companyId: string; ticketNumbers: string[] }
  ) {
    return this.raffleService.secureTicketKit(id, body.ticketNumbers, body.companyId);
  }

  @Put(':id/finish')
  async finishRaffle(
    @Param('id') id: string,
    @Body() body: { companyId: string; winningNumber: string; evidenceUrl: string }
  ) {
    return this.raffleService.finishRaffle(id, body.companyId, body.winningNumber, body.evidenceUrl);
  }

  @Post(':id/reminders')
  async sendReminders(
    @Param('id') id: string,
    @Body() body: { companyId: string }
  ) {
    return this.raffleService.sendPaymentReminders(id, body.companyId);
  }
}
