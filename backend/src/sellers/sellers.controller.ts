import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, UnauthorizedException } from '@nestjs/common';
import { SellersService } from './sellers.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/sellers')
export class SellersController {
  constructor(
    private readonly sellersService: SellersService,
    private readonly prisma: PrismaService
  ) {}

  private async getCompanyId(companyId: string) {
    if (!companyId) throw new UnauthorizedException('Company ID is required');
    return companyId;
  }

  @Post()
  async create(@Headers('x-company-id') companyId: string, @Body() data: any) {
    const cid = await this.getCompanyId(companyId);
    return this.sellersService.create(cid, data);
  }

  @Get()
  async findAll(@Headers('x-company-id') companyId: string) {
    const cid = await this.getCompanyId(companyId);
    return this.sellersService.findAll(cid);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: any) {
    return this.sellersService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sellersService.remove(id);
  }
}
