import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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
}
