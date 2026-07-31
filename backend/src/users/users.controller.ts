import { Controller, Put, Post, Get, Param, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('company/:companyId')
  async getUsersByCompany(@Param('companyId') companyId: string) {
    if (!companyId) throw new UnauthorizedException('Falta companyId');
    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true
      }
    });
    return users;
  }

  @Post('login')
  async login(@Body() body: { email: string; password?: string }) {
    if (!body.email) {
      throw new UnauthorizedException('Falta email');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      include: { company: true }
    });

    // MVP: Validación de contraseña en texto plano
    if (!user || user.password !== body.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name
    };
  }

  @Put('me')
  async updateProfile(
    @Headers('authorization') auth: string,
    @Body() body: { email: string, name?: string, password?: string, avatarUrl?: string }
  ) {
    if (!body.email) throw new UnauthorizedException('Falta email para identificar usuario');
    
    // MVP: In a real app we would use JWT or similar from headers.
    // For MVP we just match the email.
    const user = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    return this.prisma.user.update({
      where: { email: body.email },
      data: {
        name: body.name || user.name,
        password: body.password || user.password,
        avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : user.avatarUrl
      }
    });
  }
}
