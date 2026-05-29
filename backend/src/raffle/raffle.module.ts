import { Module } from '@nestjs/common';
import { RaffleController } from './raffle.controller';
import { RaffleService } from './raffle.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [RaffleController],
  providers: [RaffleService],
  exports: [RaffleService]
})
export class RaffleModule {}
