import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappGateway } from './whatsapp.gateway';
import { AiService } from '../ai/ai.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly clients = new Map<string, { client: Client, qr: string, status: string }>();
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: WhatsappGateway,
    private ai: AiService
  ) {}

  async onModuleInit() {
    this.logger.log('Inicializando Motor Multi-Tenant OmniChat CRM...');
    const companies = await this.prisma.company.findMany();
    for (const company of companies) {
      this.startSession(company.id); // Lanza la carga asíncrona sin bloquear el arranque del módulo
    }
  }

  getQrCode(companyId: string) {
    const data = this.clients.get(companyId);
    if (!data) return { qr: '', status: 'NOT_STARTED' };
    return { qr: data.qr, status: data.status };
  }

  async startSession(companyId: string) {
    if (this.clients.has(companyId)) {
       const existing = this.clients.get(companyId);
       if (existing?.status === 'READY') return;
    }

    this.logger.log(`Preparando Sesión para Company: ${companyId}`);
    this.clients.set(companyId, { client: null as any, qr: '', status: 'INITIALIZING' });

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: companyId, dataPath: './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      }
    });

    client.on('qr', (qr) => {
      this.logger.log(`[${companyId}] QR Requerido para vinculación.`);
      qrcode.generate(qr, { small: true });
      const sd = this.clients.get(companyId);
      if (sd) { sd.qr = qr; sd.status = 'AWAITING_QR'; }
    });

    client.on('ready', () => {
      this.logger.log(`✅ [${companyId}] Sesión Conectada y Escuchando.`);
      const sd = this.clients.get(companyId);
      if (sd) { sd.qr = ''; sd.status = 'READY'; }
    });

    client.on('message', async (message) => {
      await this.handleIncomingMessage(companyId, message);
    });

    try {
      await client.initialize();
      const sd = this.clients.get(companyId);
      if (sd) sd.client = client;
    } catch (e) {
      this.logger.error(`Error inicializando Client para ${companyId}`, e);
    }
  }

  async handleIncomingMessage(companyId: string, message: any) {
    if (message.from.includes('@g.us')) return;

    const phone = message.from.replace('@c.us', '');
    let textBody = message.body.trim();

    let contact = await this.prisma.contact.findFirst({
        where: { phone, companyId }
    });

    if (!contact) {
        contact = await this.prisma.contact.create({
            data: { phone, name: message._data?.notifyName || 'Nuevo Lead', companyId }
        });
    }

    let mediaUrl = null;
    let mediaType = null;

    this.logger.log(`[OmniChat-${companyId}] Mensaje Recibido de ${phone}. ¿Tiene Media?: ${message.hasMedia}`);

    if (message.hasMedia) {
        try {
            this.logger.log(`[OmniChat-${companyId}] Iniciando descarga de binario Base64...`);
            const media = await message.downloadMedia();
            this.logger.log(`[OmniChat-${companyId}] Descarga finalizada. Media Object existe: ${!!media}`);
            
            if (media && media.data) {
                const fs = require('fs');
                const path = require('path');
                
                const mimetype = media.mimetype || 'application/octet-stream';
                const ext = mimetype.includes('/') ? mimetype.split('/')[1].split(';')[0] : 'bin';
                const filename = `media_${Date.now()}_${contact.id.substring(0,8)}.${ext}`;
                
                const uploadDir = path.join(__dirname, '..', '..', 'uploads');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                
                const filepath = path.join(uploadDir, filename);
                fs.writeFileSync(filepath, media.data, { encoding: 'base64' });
                this.logger.log(`[OmniChat-${companyId}] Archivo en: ${filepath}`);
                
                const baseUrl = process.env.OMNICHAT_API_URL || 'http://localhost:3002';
                mediaUrl = `${baseUrl}/uploads/${filename}`;
                mediaType = mimetype;
                
                if (!textBody || textBody.trim() === '') {
                   textBody = `[El cliente ha enviado una imagen o archivo adjunto: ${mediaType}]`;
                }
            }
        } catch(e) {
            this.logger.error("Error crítico procesando la descarga de media", e);
        }
    }

    const savedMessage = await this.prisma.message.create({
        data: {
            body: textBody,
            fromMe: false,
            contactId: contact.id,
            mediaUrl,
            mediaType
        }
    });

    this.gateway.emitNewMessage({
       contactId: contact.id,
       message: savedMessage,
       pipeId: contact.pipelineId
    });

    // 4.5 Interceptar con Inteligencia Artificial (OpenAI)
    if (contact.botStatus === 'ACTIVE') {
       this.logger.log(`[OmniChat-${companyId}] Bot Activado para ${phone}, cediendo control a GPT-4.`);
       const aiResponse = await this.ai.generateResponse(companyId, contact.id, textBody);
       
       if (aiResponse) {
          await this.sendDirectMessage(companyId, message.from, aiResponse);
          
          const savedAiMsg = await this.prisma.message.create({
             data: {
               body: aiResponse,
               fromMe: true,
               contactId: contact.id
             }
          });
          
          this.emitToInbox(contact.id, savedAiMsg, contact.pipelineId);
          return; // Stop routing since AI answered
       }
    }

    // 5. Automated Routing Logic (Fallback Static)
    if (!contact.pipelineId) {
        
        const pipelines = await this.prisma.pipeline.findMany({ 
            where: { companyId },
            orderBy: { createdAt: 'asc' } 
        });

        const textToSearch = textBody.toLowerCase();
        let matchedPipe = null;

        for (const pipe of pipelines) {
            if (pipe.keywords) {
                const keywordsArray = pipe.keywords.split(',').map(k => k.trim().toLowerCase());
                if (keywordsArray.some(kw => textToSearch.includes(kw))) {
                    matchedPipe = pipe;
                    break; 
                }
            }
        }

        if (matchedPipe) {
            await this.prisma.contact.update({
                where: { id: contact.id },
                data: { pipelineId: matchedPipe.id }
            });

            this.gateway.emitContactRouted({ contactId: contact.id, pipeId: matchedPipe.id });

            const autoMsg = matchedPipe.autoReply 
               ? matchedPipe.autoReply.replace('{name}', contact.name || 'cliente') 
               : `✅ He detectado tu solicitud de asistencia. Te estoy canalizando de inmediato con el área de *${matchedPipe.name}*. Por favor espera un momento mientras te atendemos.`;

            await this.sendDirectMessage(companyId, message.from, autoMsg);
            return;
        }

        // 5b. Manual Digit Fallback
        const pipeIndex = parseInt(textBody) - 1;
        if (!isNaN(pipeIndex) && pipelines[pipeIndex]) {
            const selectedPipe = pipelines[pipeIndex];
            
            await this.prisma.contact.update({
                where: { id: contact.id },
                data: { pipelineId: selectedPipe.id }
            });
            
            this.gateway.emitContactRouted({ contactId: contact.id, pipeId: selectedPipe.id });

            await this.sendDirectMessage(
                companyId,
                message.from, 
                `✅ ¡Perfecto! Tu caso ha sido asignado al departamento de *${selectedPipe.name}*. Un técnico o asesor revisará tu caso y te contestará por aquí mismo muy pronto.`
            );
            return;
        }

        return this.sendBotMenu(companyId, message.from);
    }

    this.logger.log(`[OmniChat-${companyId}] Mensaje ruteado de ${phone}: ${textBody}`);
  }

  async sendBotMenu(companyId: string, targetPhone: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }});
    const menu = `👋 *¡Hola! Bienvenido a ${company?.name || 'nuestro servicio'}*\n\nSoy tu asistente de Inteligencia Artificial. ¿En qué te puedo apoyar o hacia qué departamento deseas que te comuniquemos el día de hoy?`;
    await this.sendDirectMessage(companyId, targetPhone, menu);
  }

  emitToInbox(contactId: string, message: any, pipeId: string | null) {
    this.gateway.emitNewMessage({ contactId, message, pipeId });
  }

  async sendDirectMessage(companyId: string, targetPhone: string, text: string) {
    const data = this.clients.get(companyId);
    if (!data || data.status !== 'READY' || !data.client) {
      throw new Error(`[OmniChat] La sesión de WhatsApp de la empresa no está inicializada o conectada.`);
    }

    let finalTarget = targetPhone;
    
    if (targetPhone.endsWith('@c.us')) {
        const rawNumber = targetPhone.replace('@c.us', '');
        let idObj = null;
        try {
            idObj = await data.client.getNumberId(rawNumber);
        } catch(e) {}
        
        if (idObj && idObj._serialized) {
            finalTarget = idObj._serialized;
        } else {
            // Is it a Mexican number starting with 521? Try falling back to 52
            if (rawNumber.startsWith('521') && rawNumber.length === 13) {
                const fallbackNumber = '52' + rawNumber.substring(3);
                let fallbackId = null;
                try { fallbackId = await data.client.getNumberId(fallbackNumber); } catch(e){}
                if (fallbackId && fallbackId._serialized) {
                    finalTarget = fallbackId._serialized;
                    this.logger.log(`[OmniChat] Ajustando prefijo Mexicano: ${rawNumber} -> ${fallbackNumber}`);
                } else {
                    throw new Error(`El celular técnico ${rawNumber} no figura en los servidores de WhatsApp.`);
                }
            } else if (rawNumber.startsWith('52') && rawNumber.length === 12) {
                const fallbackNumber = '521' + rawNumber.substring(2);
                let fallbackId = null;
                try { fallbackId = await data.client.getNumberId(fallbackNumber); } catch(e){}
                if (fallbackId && fallbackId._serialized) {
                    finalTarget = fallbackId._serialized;
                    this.logger.log(`[OmniChat] Ajustando prefijo Mexicano: ${rawNumber} -> ${fallbackNumber}`);
                } else {
                    throw new Error(`El celular técnico ${rawNumber} no figura en los servidores de WhatsApp.`);
                }
            } else {
               throw new Error(`El número ${rawNumber} no tiene cuenta de WhatsApp activa.`);
            }
        }
    }

    await data.client.sendMessage(finalTarget, text);
  }

  async sendDirectMediaMessage(companyId: string, targetPhone: string, filePath: string) {
    const data = this.clients.get(companyId);
    if (!data || data.status !== 'READY' || !data.client) {
      throw new Error(`[OmniChat] La sesión de WhatsApp de la empresa no está inicializada o conectada.`);
    }
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(filePath);
    await data.client.sendMessage(targetPhone, media);
  }

  public async launchBroadcast(campaignId: string, companyId: string, messageText: string, audience: string, tag?: string, mediaFilePath?: string) {
    // Fire and forget to prevent HTTP timeout. Runs purely in Node background memory.
    setTimeout(async () => {
      this.logger.log(`[OmniChat] Iniciando Broadcast SaaS para ${companyId}. Audiencia: ${audience}`);
      let contacts = [];
      
      if (audience === 'tag' && tag) {
         contacts = await this.prisma.contact.findMany({ where: { companyId, tags: { has: tag } }});
      } else {
         contacts = await this.prisma.contact.findMany({ where: { companyId }});
      }

      this.logger.log(`[OmniChat] 🚀 Broadcast encoló ${contacts.length} destinos.`);
      
      let successCount = 0;
      let failedCount = 0;

      for (const contact of contacts) {
         try {
            // Meta Anti-Spam Throttling: Random delay between 3,500ms and 8,000ms
            let delayMs = Math.floor(Math.random() * (8000 - 3500 + 1) + 3500);
            if (mediaFilePath) {
                delayMs += 2500; // Extra delay for media to replicate human behavior
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Token injection
            const personalizedMsg = messageText.replace(/{name}/g, contact.name || 'cliente');
            
            let targetPhone = contact.phone;
            if (!targetPhone.includes('@')) targetPhone = `${targetPhone}@c.us`;

            // Enviar Fotografía/Archivo si hay
            if (mediaFilePath) {
                await this.sendDirectMediaMessage(companyId, targetPhone, mediaFilePath);
            }

            // Enviar el Texto
            await this.sendDirectMessage(companyId, targetPhone, personalizedMsg);

            // Persist the automated dispatch in the database inbox
            const savedMsg = await this.prisma.message.create({
                data: {
                    body: personalizedMsg,
                    fromMe: true,
                    contactId: contact.id,
                    mediaUrl: mediaFilePath ? `Campaign Media` : null
                }
            });

            // Emit to frontend (Visual update if Inbox is open)
            this.gateway.emitNewMessage({
               contactId: contact.id,
               message: savedMsg,
               pipeId: contact.pipelineId
            });

            successCount++;
            this.logger.log(`[OmniChat] Broadcast disparado exitosamente a -> ${contact.phone} (Retraso aplicado: ${delayMs}ms)`);
            
            // Periódicamente actualizamos la BD
            if (successCount % 5 === 0) {
               await this.prisma.campaign.update({
                 where: { id: campaignId },
                 data: { successCount }
               });
            }

         } catch(e) {
            failedCount++;
            this.logger.error(`[OmniChat] Error disparando Broadcast a ${contact.phone}`, e);
         }
      }
      
      // Final Update
      await this.prisma.campaign.update({
         where: { id: campaignId },
         data: { status: 'COMPLETED', successCount, failedCount }
      });

      this.logger.log(`[OmniChat] ✅ Campaña Masiva Finalizada (${successCount} Éxitos, ${failedCount} Fallos).`);
    }, 100);
  }
}
