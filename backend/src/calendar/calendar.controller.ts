import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CalendarService } from './calendar.service';

@Controller('api/v1/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get(':companyId')
  async getEvents(
    @Param('companyId') companyId: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('assignedToId') assignedToId?: string
  ) {
    return await this.calendarService.getEventsByCompany(companyId, start, end, assignedToId);
  }

  @Post(':companyId')
  async createEvent(
    @Param('companyId') companyId: string,
    @Body() body: any
  ) {
    return await this.calendarService.createEvent(companyId, body);
  }

  @Put(':companyId/:id')
  async updateEvent(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: any
  ) {
    return await this.calendarService.updateEvent(id, companyId, body);
  }

  @Delete(':companyId/:id')
  async deleteEvent(
    @Param('companyId') companyId: string,
    @Param('id') id: string
  ) {
    return await this.calendarService.deleteEvent(id, companyId);
  }

  @Get('debug/test-sync/:userId')
  async testSync(@Param('userId') userId: string) {
    try {
      const eventData = {
        title: "Test Event OmniChat",
        description: "Diagnostic test",
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000)
      };
      // Use any to bypass private access if needed, or call public method
      await (this.calendarService as any).googleService.syncEventToGoogle(userId, eventData);
      return { success: true, message: "Sync command sent to Google without throwing errors." };
    } catch (e) {
      return { success: false, error: e.message, stack: e.stack };
    }
  }

  @Post('evidence/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `evidence-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadEvidence(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("Archivo no recibido");
    }
    // Asumimos que el backend corre en el puerto 3002
    const fileUrl = `http://137.184.155.133:3002/uploads/${file.filename}`;
    return { success: true, url: fileUrl };
  }
}
