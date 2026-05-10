import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GoogleController],
  providers: [GoogleService],
  exports: [GoogleService]
})
export class GoogleModule {}
