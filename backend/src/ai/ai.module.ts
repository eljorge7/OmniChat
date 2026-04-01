import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule], // WhatsappModule would cause a circular dependency if imported here without forwardRef
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
