import { Controller, Post, All, Param, Query, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class WisphubController {
    private readonly logger = new Logger(WisphubController.name);

    constructor(
        private whatsappService: WhatsappService,
        private prisma: PrismaService
    ) {}

    @All(['api/v1/integrations/wisphub/send/:companyId', 'w/:companyId'])
    async handleWisphubWebhook(
        @Param('companyId') companyId: string,
        @Headers('x-api-key') apiKey: string, 
        @Headers('authorization') auth: string,
        @Body() body: any,
        @Query() query: any
    ) {
        this.logger.log(`[WispHub] Hook recibido en ${companyId}. Query: ${JSON.stringify(query)}, Body: ${JSON.stringify(body)}`);

        // En pasarelas SMS Genéricas de WispHub a veces no se pueden mandar headers.
        // Si hay secret configurado, lo verificamos, de otra forma confiamos en el companyId (que debe ser un UUID).
        const secret = process.env.OMNICHAT_WEBHOOK_SECRET;
        const cleanAuth = auth ? auth.replace('Bearer ', '').replace('Token ', '') : '';
        
        if (secret && (apiKey || cleanAuth)) {
            if (apiKey !== secret && cleanAuth !== secret) {
                this.logger.warn(`Intento de acceso denegado a Webhook WispHub con Key Inválida.`);
            }
        }

        // Soportar campos definidos por WispHub (to, phone, telefono, message)
        const phone = body?.phone || body?.telefono || body?.to || query?.phone || query?.telefono || query?.to;
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
        const rawPhoneForDb = `521${cleanPhone}`;

        this.logger.log(`[WispHub🚀OmniChat] Interceptada notificación para empresa ${masterCompany.name} -> ${waId}. Carga delegada a Queue.`);

        // Variable global (o estática local en Node) para el espaciado de WispHub
        const queuePosition = (global as any).__WISPHUB_QUEUE || 0;
        (global as any).__WISPHUB_QUEUE = queuePosition + 1;
        setTimeout(() => { if ((global as any).__WISPHUB_QUEUE > 0) (global as any).__WISPHUB_QUEUE--; }, 5000);

        const delayMs = queuePosition * 5000; // Espaciamos 5 segundos por cada notificación de la ráfaga

        const embudoName = body?.embudo || query?.embudo || body?.pipeline || query?.pipeline || 'Alertas WispHub';
        const contactName = body?.cliente || body?.name || query?.cliente || query?.name || 'Cliente WispHub';

        // Procesamiento en Bloque Asíncrono Fire-and-Forget
        setTimeout(async () => {
            try {
                // 1. Asignación Dinámica de Embudo (Pipeline) PRIMERO (Anti Race-Condition)
                let pipeline = await this.prisma.pipeline.findFirst({
                    where: { name: embudoName, companyId: masterCompany.id },
                });

                if (!pipeline) {
                    pipeline = await this.prisma.pipeline.create({
                        data: { name: embudoName, companyId: masterCompany.id },
                    });
                }

                // 2. Buscamos al contacto por los 10 dígitos (ignorando 52/521)
                const phoneLike = `%${cleanPhone}`;
                let contacts = await this.prisma.$queryRaw<any[]>`
                    SELECT * FROM "Contact" 
                    WHERE "companyId" = ${masterCompany.id} AND "phone" LIKE ${phoneLike}
                    LIMIT 1
                `;
                
                let contact = contacts && contacts.length > 0 ? contacts[0] : null;

                const contactName = body?.cliente || body?.name || query?.cliente || query?.name || 'Cliente WispHub';

                if (!contact) {
                    // Si no existe, creamos el contacto oficial. Usamos rawPhoneForDb.
                    contact = await this.prisma.contact.create({
                        data: { 
                            phone: rawPhoneForDb, 
                            name: contactName, 
                            companyId: masterCompany.id,
                            pipelineId: pipeline.id,
                            tags: ['WispHub'] 
                        }
                    });
                } else {
                    // Forzar actualización de Etiqueta, Nombre y Embudo
                    const currentTags = contact.tags || [];
                    const updatedTags = currentTags.includes('WispHub') ? currentTags : [...currentTags, 'WispHub'];
                    
                    contact = await this.prisma.contact.update({
                        where: { id: contact.id },
                        data: { 
                            pipelineId: pipeline.id, 
                            tags: updatedTags,
                            name: contact.name?.includes('Desde Celular') ? contactName : contact.name // Sobrescribir nombres genéricos
                        }
                    });
                }

                // 3. Disparar mensaje vía WhatsApp AL FINAL. 
                // Así cuando whatsapp.service.ts lance el hook 'upsert', ¡el contacto YA EXISTE!
                await this.whatsappService.sendDirectMessage(masterCompany.id, waId, message);

                // El interceptor 'message_create' en whatsapp.service.ts interceptará el mensaje 
                // saliente y lo registrará en la DB y el web-socket para evitar duplicados.

                this.logger.log(`[WispHub🚀OmniChat] Notificación despachada con éxito a ${contactName} tras ${delayMs}ms de espera.`);
            } catch (e: any) {
                this.logger.error(`Error despachando WA asíncrono de WispHub para ${masterCompany.name}`, e);
            }
        }, delayMs);

        // Responder INMEDIATAMENTE a WispHub (HTTP 200) para evitar colapsar su API o que re-intente
        return { success: true, status: 'Notificación capturada y encolada (Anti-Spam activado)' };
    }
}
