import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { PrismaModule } from './prisma/prisma.module';
import { AdminController } from './admin/admin.controller';
import { UsersController } from './users/users.controller';
import { CalendarModule } from './calendar/calendar.module';
import { GoogleModule } from './google/google.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { CryptoModule } from './crypto/crypto.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CompaniesModule } from './companies/companies.module';
import { PaymentsModule } from './payments/payments.module';
import { RaffleModule } from './raffle/raffle.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/api/uploads',
    }),
    PrismaModule, 
    WhatsappModule,
    CalendarModule,
    GoogleModule,
    CryptoModule,
    RaffleModule,
    CompaniesModule,
    PaymentsModule
  ],
  controllers: [AppController, AdminController, UsersController],
  providers: [AppService],
})
export class AppModule {}
