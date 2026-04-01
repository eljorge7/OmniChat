import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeController],
  providers: [AiService, KnowledgeService],
  exports: [AiService, KnowledgeService],
})
export class AiModule {}
