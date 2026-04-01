import { Controller, Post, Body, Headers, UnauthorizedException, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';

@Controller('api/v1/messages')
export class ApiController {
  private readonly logger = new Logger(ApiController.name);

  constructor(
    private prisma: PrismaService, 
    private whatsapp: WhatsappService,
    private gateway: WhatsappGateway
  ) {}

  @Post('send')
  async sendGatewayMessage(
    @Headers('authorization') auth: string,
    @Body() body: { phone: string, text: string }
  ) {
    try {
      this.logger.log(`[OmniChat API] Webhook entrante para enviar mensaje a ${body.phone}`);
      if (!auth || !auth.startsWith('Bearer ')) {
        throw new UnauthorizedException('API Key requerida (Bearer token)');
      }
      const apiKey = auth.split(' ')[1];
      
      const company = await this.prisma.company.findUnique({ where: { apiKey } });
      if (!company) throw new UnauthorizedException('API Key inválida');
      
      let targetPhone = body.phone.replace(/\+/g, '').replace(' ', '');
      
      let contact = await this.prisma.contact.findFirst({
          where: { phone: targetPhone, companyId: company.id }
      });
      
      if (!contact) {
          contact = await this.prisma.contact.create({
              data: { phone: targetPhone, name: 'Lead Externo API', companyId: company.id }
          });
      }

      if (!targetPhone.includes('@')) {
          targetPhone = `${targetPhone}@c.us`;
      }

      await this.whatsapp.sendDirectMessage(company.id, targetPhone, body.text);
      
      const savedMessage = await this.prisma.message.create({
          data: {
              body: body.text,
              fromMe: true,
              contactId: contact.id
          }
      });

      this.gateway.emitNewMessage({
          contactId: contact.id,
          message: savedMessage,
          pipeId: contact.pipelineId
      });

      this.logger.log(`[OmniChat API] Mensaje guardado y evento socket emitido exitosamente`);
      return { success: true, message: 'Mensaje despachado exitosamente por la API' };
    } catch(e: any) {
      this.logger.error(`[OmniChat API CRASH]: ${e.message} \n ${e.stack}`);
      throw new InternalServerErrorException(e.message);
    }
  }
}
