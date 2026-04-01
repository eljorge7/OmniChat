import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/integrations/wisphub')
export class WisphubController {
    private readonly logger = new Logger(WisphubController.name);

    constructor(
        private whatsappService: WhatsappService,
        private prisma: PrismaService
    ) {}

    @Post('send')
    async handleWisphubWebhook(
        @Headers('x-api-key') apiKey: string, 
        @Headers('authorization') auth: string,
        @Body() body: any
    ) {
        const secret = process.env.OMNICHAT_WEBHOOK_SECRET || 'SUPER_SECRET_KEY_123';
        const cleanAuth = auth ? auth.replace('Bearer ', '').replace('Token ', '') : '';
        
        if (apiKey !== secret && cleanAuth !== secret) {
            throw new UnauthorizedException('API Key Inválida para Integración WispHub');
        }

        // Soportar campos en inglés o español según Jorge lo configure en el portal
        const phone = body.phone || body.telefono;
        const message = body.message || body.mensaje;

        if (!phone || !message) {
            return { error: 'Faltan parámetros phone o message en el JSON.' };
        }

        // Centralizar envío de facturas WispHub por el número maestro (Grupo Hurtado)
        const masterCompany = await this.prisma.company.findFirst({
            where: { name: { contains: 'hurtado', mode: 'insensitive' } }
        });

        if (!masterCompany) {
            return { error: 'No se encontró la empresa "Grupo Hurtado" registrada como Hub principal.' };
        }

        this.logger.log(`[WispHub🚀OmniChat] Interceptada notificación de facturación para: ${phone}`);

        try {
            // Disparar mensaje vía WhatsApp Maestro (Sin costo extra)
            await this.whatsappService.sendDirectMessage(masterCompany.id, `${phone}@c.us`, message);
            
            let contact = await this.prisma.contact.findFirst({
                where: { phone, companyId: masterCompany.id }
            });

            if (!contact) {
                contact = await this.prisma.contact.create({
                    data: { phone, name: body.cliente || body.name || 'WispHub Lead', companyId: masterCompany.id }
                });
            }

            // Registrar legalmente el mensaje enviado en el hilo
            await this.prisma.message.create({
                data: {
                    body: message,
                    fromMe: true, // Fue el bot/consola
                    contactId: contact.id
                }
            });

            return { success: true, status: 'Notificación aterrizada al celular del cliente (Vía RadioTec)' };
        } catch (e: any) {
            this.logger.error('Error despachando WA de WispHub', e);
            return { error: e.message };
        }
    }
}
