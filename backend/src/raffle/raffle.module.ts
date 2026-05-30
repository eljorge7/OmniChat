import { Module } from '@nestjs/common';
import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';
import { TicketGeneratorService } from './ticket-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), WhatsappModule],
  controllers: [RaffleController],
  providers: [RaffleService, TicketGeneratorService],
  exports: [RaffleService]
})
export class RaffleModule {}
