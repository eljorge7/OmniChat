import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('api/v1/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get(':companyId')
  async getEvents(
    @Param('companyId') companyId: string,
    @Query('start') start?: string,
    @Query('end') end?: string
  ) {
    return await this.calendarService.getEventsByCompany(companyId, start, end);
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
}
