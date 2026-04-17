import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappGateway } from './whatsapp.gateway';
import { AiService } from '../ai/ai.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly clients = new Map<string, { client: Client, qr: string, status: string }>();
  private readonly incomingRateLimit = new Map<string, { count: number, resetAt: number }>();
  private readonly aiDebounceTimers = new Map<string, NodeJS.Timeout>();
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
    this.startFollowupCron();
  }

  private startFollowupCron() {
    this.logger.log('Iniciando cron interno de Recordatorios/Followups (Revisión cada minuto)...');
    setInterval(async () => {
       try {
           const pendingReminders = await this.prisma.calendarEvent.findMany({
               where: {
                   title: 'BOT_FOLLOWUP',
                   status: 'SCHEDULED',
                   startTime: { lte: new Date() } // Todo lo que esté en el pasado o presente exacto
               },
               include: { contact: true }
           });

           for (const reminder of pendingReminders) {
               if (!reminder.contact || !reminder.contact.phone) continue;
               
               this.logger.log(`[FOLLOWUP CRON] Disparando recordatorio a ${reminder.contact.name} (${reminder.contact.phone})`);
               
               // Enviar mensaje real
               try {
                   await this.sendDirectMessage(reminder.companyId, `${reminder.contact.phone}@c.us`, reminder.description || "Hola, retomando nuestro tema pendiente.");
                   
                   // Guardar en tabla Messages simulado como enviado desde backend
                   const savedMsg = await this.prisma.message.create({
                       data: {
                           body: reminder.description || "Hola, retomando nuestro tema pendiente.",
                           fromMe: true,
                           contactId: reminder.contact.id
                       }
                   });

                   this.gateway.emitNewMessage({
                       contactId: reminder.contact.id,
                       message: savedMsg,
                       pipeId: reminder.contact.pipelineId
                   });

                   // Marcar como COMPLETED para que no dispare doble
                   await this.prisma.calendarEvent.update({
                       where: { id: reminder.id },
                       data: { status: 'COMPLETED' }
                   });

               } catch(ex) {
                   this.logger.error(`Error enviando followup a ${reminder.contact.phone}`, ex);
                   // Move to FAILED or leave scheduled to retry maybe?
                   await this.prisma.calendarEvent.update({
                       where: { id: reminder.id },
                       data: { status: 'FAILED_RETRY' }
                   });
               }
           }
       } catch(e) {
           this.logger.error('Error en loop cron de follow up', e);
       }
    }, 60000); // 1 minuto
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
    const sessionPath = `./.wwebjs_auth/session-${companyId}`;
    try {
       const fs = require('fs');
       const lockFile = `${sessionPath}/SingletonLock`;
       const cookieFile = `${sessionPath}/SingletonCookie`;
       try { fs.unlinkSync(lockFile); } catch (e) {}
       try { fs.unlinkSync(cookieFile); } catch (e) {}
       this.logger.log(`[OmniChat-${companyId}] Candados borrados preventivamente.`);
    } catch {}

    this.clients.set(companyId, { client: null as any, qr: '', status: 'INITIALIZING' });

    // Guardar el tiempo estricto en que inicializa este contenedor para descartar TODO el historial de WA
    const sessionStartupTime = Math.floor(Date.now() / 1000);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: companyId, dataPath: './.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined),
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
      // Ignorar mensajes históricos que llegan por montón al iniciar la sesión (QR scan)
      // Comparamos contra sessionStartupTime para evitar problemas de desfase de reloj del VPS
      if (message.timestamp < sessionStartupTime - 60) {
         this.logger.log(`[OmniChat-${companyId}] Ignorando mensaje histórico procesado al arrancar motor WA.`);
         return;
      }
      await this.handleIncomingMessage(companyId, message);
    });

    client.on('message_create', async (message) => {
      // Interceptar los mensajes que salen físicamente desde el celular de Jorge
      if (message.timestamp < sessionStartupTime - 60) return;
      if (message.fromMe) {
          await this.handleOutgoingPhoneMessage(companyId, message);
      }
    });

    try {
      await client.initialize();
      const sd = this.clients.get(companyId);
      if (sd) sd.client = client;
    } catch (e) {
      this.logger.error(`Error inicializando Client para ${companyId}`, e);
    }
  }

  async handleOutgoingPhoneMessage(companyId: string, message: any) {
    if (message.to.includes('@g.us') || message.isStatus || message.broadcast) return;

    const phone = message.to.replace('@c.us', '');
    let textBody = message.body ? message.body.trim() : '';
    if (!textBody && message.hasMedia) {
        textBody = '[Multimedia o Archivo enviado desde Celular]';
    }

    // Filtro Quirúrgico: Matar el Autoresponder Fantasma Inyectado por Facebook / Meta Business Suite
    // (Aparece cuando WispHub abre un chat a un cliente y Meta detecta la sesión ligada)
    if (textBody.includes('¿En qué puedo ayudarte hoy?') && message.to.includes('@lid')) {
        this.logger.log(`[OmniChat] Filtro aplicado: Ignorando 'Mensaje de Bienvenida' fantasma de Meta Business Suite hacia el LID ${message.to}.`);
        return;
    }

    let contact = await this.prisma.contact.findFirst({ where: { phone, companyId } });
    if (!contact) {
        // En caso de que Jorge le hable a alguien nuevo directo desde su móvil
        contact = await this.prisma.contact.create({
            data: { phone, name: 'Contacto (Desde Celular)', companyId }
        });
    }

    // Prevención de duplicados originados por la propia API / WebHooks
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const recentDuplicates = await this.prisma.message.findMany({
        where: {
           contactId: contact.id,
           fromMe: true,
           timestamp: { gte: tenSecondsAgo }
        }
    });

    // Comparación robusta ignorando saltos de línea y espacios
    const incomingPreview = textBody.replace(/\s+/g, '').substring(0, 50);
    const isDuplicate = recentDuplicates.some(msg => 
        (msg.body || '').replace(/\s+/g, '').substring(0, 50) === incomingPreview
    );

    if (isDuplicate) return;

    const savedMessage = await this.prisma.message.create({
        data: {
            body: textBody,
            fromMe: true,
            contactId: contact.id
        }
    });

    // Animar la interfaz visual en tiempo real de OmniChat
    this.gateway.emitNewMessage({
       contactId: contact.id,
       message: savedMessage,
       pipeId: contact.pipelineId
    });

    this.logger.log(`[OmniChat-${companyId}] Mensaje saliente desde celular sincronizado: ${textBody}`);
  }

  async handleIncomingMessage(companyId: string, message: any) {
    // 0. Bloqueo absoluto de carreras M2M y Autorespuestas al inicio
    if (message.fromMe) {
        return; // handleOutgoingPhoneMessage ya procesa esto
    }

    if (message.from.includes('@g.us')) return; // No responder a grupos
    // Se removió el bloqueo de '@lid' porque clientes externos empresariales (ej. TotalPlay) 
    // operan con IDs '@lid'. Los ecos "fantasmas" ya son descartados por isDuplicate.

    // Corrección ultra agresiva de Bug: Evitar publicar / responder a Estados o Difusiones
    if (message.isStatus || message.broadcast || message.from === 'status@broadcast' || message.id?.remote === 'status@broadcast') {
       return; 
    }

    const phone = message.from.replace('@c.us', '');
    let textBody = message.body.trim();

    // =============== ANTI BOT-LOOP RATE LIMITER ===============
    // Prevent infinite ping-pong loops against WA Business Auto-Responders
    const now = Date.now();
    let rateData = this.incomingRateLimit.get(phone);
    
    if (!rateData || now > rateData.resetAt) {
        // Reset counter every 15 seconds
        rateData = { count: 1, resetAt: now + 15000 };
    } else {
        rateData.count++;
    }
    this.incomingRateLimit.set(phone, rateData);

    if (rateData.count > 3) {
        this.logger.warn(`[ANTI-BOT LOOP] Ignorando a ${phone} temporalmente por SPAMMING (>3 msgs en 15s).`);
        return; // Break the infinite auto-responder loop
    }
    // ==========================================================

    let contact = await this.prisma.contact.findFirst({
        where: { phone, companyId }
    });

    if (!contact) {
        contact = await this.prisma.contact.create({
            data: { phone, name: message._data?.notifyName || 'Nuevo Lead', companyId }
        });
    }

    // Extracción asíncrona de Avatar (si no tiene)
    if (!contact.avatarUrl) {
       this.clients.get(companyId)?.client?.getProfilePicUrl(message.from)
         .then(url => {
            if (url) {
               this.prisma.contact.update({ where: { id: contact.id }, data: { avatarUrl: url } }).catch(()=>{});
            }
         }).catch(()=>{});
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
                
                const uploadDir = path.join(process.cwd(), 'uploads');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                
                const filepath = path.join(uploadDir, filename);
                fs.writeFileSync(filepath, media.data, { encoding: 'base64' });
                this.logger.log(`[OmniChat-${companyId}] Archivo en: ${filepath}`);
                
                const baseUrl = process.env.OMNICHAT_API_URL || 'http://localhost:3002';
                mediaUrl = `${baseUrl}/uploads/${filename}`;
                mediaType = mimetype;
                
                if (message.type === 'ptt' || mimetype.startsWith('audio/') || mimetype.startsWith('video/ogg')) {
                   // Transcripción de Audio en vuelo
                   const transcript = await this.ai.transcribeAudio(filepath, companyId);
                   if (transcript) {
                      textBody = `[Nota de voz transcrita automáticamente]: ${transcript}`;
                   } else {
                      textBody = `[El cliente ha enviado un AUDIO que no se pudo transcribir, escúchalo antes de responder]`;
                   }
                } else if (!textBody || textBody.trim() === '') {
                   textBody = `[El cliente ha enviado una imagen adjunta]`;
                }
            }
        } catch(e) {
            this.logger.error("Error crítico procesando la descarga de media", e);
        }
    }

    const savedMessage = await this.prisma.message.create({
        data: {
            body: textBody,
            fromMe: false, // Cliente externo
            contactId: contact.id,
            mediaUrl,
            mediaType
        }
    });

    // Subir el conteo de no leídos
    await this.prisma.contact.update({
        where: { id: contact.id },
        data: { unreadCount: { increment: 1 } }
    });

    this.gateway.emitNewMessage({
       contactId: contact.id,
       message: savedMessage,
       pipeId: contact.pipelineId,
       unreadCountUpdate: true
    });

    // 4.5 Interceptar con Inteligencia Artificial o Verificar Pausa Humana
    if (contact.botStatus === 'PAUSED') {
       this.logger.log(`[OmniChat-${companyId}] IA Pausada para ${phone}. Ignorando ruteo automático.`);
       return; 
    }

    if (contact.botStatus === 'ACTIVE') {
       this.logger.log(`[OmniChat-${companyId}] Bot IA Activado para ${phone}. Simulando espera humana (Debounce 5s)...`);
       
       if (this.aiDebounceTimers.has(contact.id)) {
           clearTimeout(this.aiDebounceTimers.get(contact.id));
       }

       const timer = setTimeout(async () => {
           this.aiDebounceTimers.delete(contact.id);
           this.logger.log(`[OmniChat-DEBOUNCE] Evaluando ráfaga completa de historial para ${contact.name}...`);
           
           try {
               const aiResponse = await this.ai.generateResponse(companyId, contact.id, textBody, mediaUrl || undefined, mediaType || undefined);
               
               if (aiResponse) {
                  await this.sendDirectMessage(companyId, message.from, aiResponse);
               }
           } catch (error) {
               this.logger.error("Error crítico en bloque Debounce de IA", error);
           }
       }, 5500); // 5.5s de espera natural para dejar que el cliente termine de tipear todo

       this.aiDebounceTimers.set(contact.id, timer);
       return; // Detenemos rutinas estáticas porque la IA está encargada de este hilo
    }

    if (contact.botStatus === 'PAUSED' || contact.botStatus === 'INACTIVE') {
        this.logger.log(`[OmniChat] Bot silenciado para ${phone} (botStatus: ${contact.botStatus}). Omitiendo auto-router estático.`);
        return; // Silencio total. El agente humano tiene el control.
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
