import { Controller, Get, Put, Post, Body, Param, Headers, UnauthorizedException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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
      themeColor: company.themeColor,
      whatsappNumber: company.whatsappNumber
    };
  }

  @Put('me')
  async updateCompany(
    @Headers('authorization') auth: string,
    @Body() body: { email: string, logoUrl?: string, themeColor?: string, whatsappNumber?: string }
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
        themeColor: body.themeColor !== undefined ? body.themeColor : user.company.themeColor,
        whatsappNumber: body.whatsappNumber !== undefined ? body.whatsappNumber : user.company.whatsappNumber
      }
    });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `company-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadLogo(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException("Archivo no encontrado");
    
    // Asumimos API URL configurada, o fallback a localhost:3002
    const mediaUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/uploads/${file.filename}`;
    
    return { mediaUrl };
  }
}
