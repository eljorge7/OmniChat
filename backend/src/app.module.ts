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

import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule, 
    WhatsappModule,
    CalendarModule
  ],
  controllers: [AppController, AdminController, UsersController],
  providers: [AppService],
})
export class AppModule {}
