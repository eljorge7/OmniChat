import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RaffleModule } from '../raffle/raffle.module';

@Module({
  imports: [PrismaModule, WhatsappModule, RaffleModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
