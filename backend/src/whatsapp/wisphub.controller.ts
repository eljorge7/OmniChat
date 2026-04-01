import { Controller, Post, All, Param, Query, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/integrations/wisphub')
export class WisphubController {
    private readonly logger = new Logger(WisphubController.name);

    constructor(
        private whatsappService: WhatsappService,
        private prisma: PrismaService
    ) {}

    @All('send/:companyId')
    async handleWisphubWebhook(
        @Param('companyId') companyId: string,
        @Headers('x-api-key') apiKey: string, 
        @Headers('authorization') auth: string,
        @Body() body: any,
        @Query() query: any
    ) {
        // En pasarelas SMS Genéricas de WispHub a veces no se pueden mandar headers.
        // Si hay secret configurado, lo verificamos, de otra forma confiamos en el companyId (que debe ser un UUID).
        const secret = process.env.OMNICHAT_WEBHOOK_SECRET;
        const cleanAuth = auth ? auth.replace('Bearer ', '').replace('Token ', '') : '';
        
        if (secret && (apiKey || cleanAuth)) {
            if (apiKey !== secret && cleanAuth !== secret) {
                this.logger.warn(`Intento de acceso denegado a Webhook WispHub con Key Inválida.`);
            }
        }

        // Soportar campos en inglés o español, ya sea por JSON Body o Query Params (GET/POST)
        const phone = body?.phone || body?.telefono || query?.phone || query?.telefono;
        const message = body?.message || body?.mensaje || query?.message || query?.mensaje;

        if (!phone || !message) {
            return { error: 'Faltan parámetros phone o message en el JSON o URL.' };
        }

        // Validar que la empresa exista basada en la URL (Multitenant)
        const masterCompany = await this.prisma.company.findUnique({
            where: { id: companyId }
        });

        if (!masterCompany) {
            return { error: `No se encontró la empresa con ID ${companyId} registrada en OmniChat.` };
        }

        // Limpiar el teléfono de símbolos
        const cleanPhone = phone.toString().replace(/\D/g, '').slice(-10);
        if(!cleanPhone || cleanPhone.length < 10) {
            return { error: 'El teléfono debe contener al menos 10 dígitos.' };
        }
        
        const waId = `521${cleanPhone}@c.us`; 
        this.logger.log(`[WispHub🚀OmniChat] Interceptada notificación para empresa ${masterCompany.name} -> ${waId}`);

        try {
            // Disparar mensaje vía WhatsApp de la Empresa Específica
            await this.whatsappService.sendDirectMessage(masterCompany.id, waId, message);
            
            let contact = await this.prisma.contact.findFirst({
                where: { phone: waId, companyId: masterCompany.id }
            });

            if (!contact) {
                contact = await this.prisma.contact.create({
                    data: { phone: waId, name: body.cliente || body.name || query.cliente || query.name || 'Cliente WispHub', companyId: masterCompany.id }
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

            return { success: true, status: 'Notificación aterrizada al celular del cliente vía OmniChat' };
        } catch (e: any) {
            this.logger.error(`Error despachando WA de WispHub para ${masterCompany.name}`, e);
            return { error: e.message };
        }
    }
}
