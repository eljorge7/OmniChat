import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, WhatsappModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
