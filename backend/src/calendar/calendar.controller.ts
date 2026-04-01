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
}
