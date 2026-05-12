import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [PrismaModule, GoogleModule],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService]
})
export class CalendarModule {}
