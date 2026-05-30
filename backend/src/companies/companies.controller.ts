import { Controller, Get, Put, Body, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/companies')
export class CompaniesController {
  constructor(private prisma: PrismaService) {}

  @Get(':id/public')
  async getPublicProfile(@Param('id') id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id }
    });
    if (!company) return null;
    return {
      id: company.id,
      name: company.name,
      logoUrl: company.logoUrl,
      themeColor: company.themeColor
    };
  }

  @Put('me')
  async updateCompany(
    @Headers('authorization') auth: string,
    @Body() body: { email: string, logoUrl?: string, themeColor?: string }
  ) {
    if (!body.email) throw new UnauthorizedException('Falta email');
    
    const user = await this.prisma.user.findUnique({ 
      where: { email: body.email },
      include: { company: true }
    });
    
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    return this.prisma.company.update({
      where: { id: user.companyId },
      data: {
        logoUrl: body.logoUrl !== undefined ? body.logoUrl : user.company.logoUrl,
        themeColor: body.themeColor !== undefined ? body.themeColor : user.company.themeColor
      }
    });
  }
}
