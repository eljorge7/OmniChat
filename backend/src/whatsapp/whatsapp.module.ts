import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappController } from './whatsapp.controller';
import { ApiController } from './api.controller';
import { WisphubController } from './wisphub.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [PrismaModule, AiModule, GoogleModule],
  controllers: [WhatsappController, ApiController, WisphubController],
  providers: [WhatsappService, WhatsappGateway],
  exports: [WhatsappService, WhatsappGateway],
})
export class WhatsappModule {}
