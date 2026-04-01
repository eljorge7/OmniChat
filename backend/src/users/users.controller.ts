import { Controller, Put, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

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
