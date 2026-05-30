import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappGateway } from './whatsapp.gateway';
import { AiService } from '../ai/ai.service';
import { GoogleService } from '../google/google.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly clients = new Map<string, { client: Client, qr: string, status: string }>();
  private readonly incomingRateLimit = new Map<string, { count: number, resetAt: number }>();
  private readonly aiDebounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: WhatsappGateway,
    private ai: AiService,
    private googleService: GoogleService
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
      webVersionCache: {
        type: 'none',
      },
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
      // Ignorar mensajes enviados antes de que el servidor se conectara (sincronización inicial)
      if (message.timestamp < sessionStartupTime) {
         this.logger.log(`[OmniChat-${companyId}] Ignorando mensaje histórico (muy antiguo).`);
         return;
      }

      if (message.type === 'call_log') {
         this.logger.log(`[OmniChat] Detectada llamada perdida de ${message.from}. Enviando auto-respuesta.`);
         await client.sendMessage(message.from, "Hola! Soy Julio 🤖. Ahorita las líneas telefónicas están saturadas y no puedo contestar llamadas de voz, pero escríbeme o mándame un audio por aquí y te atiendo al instante. ¡Soy todo oídos!");
         return;
      }

      await this.handleIncomingMessage(companyId, message);
    });

    client.on('message_create', async (message) => {
      // Ignorar los mensajes históricos
      if (message.timestamp < sessionStartupTime) return;

      this.logger.log(`[OmniChat-Debug] Mensaje detectado. Tipo: ${message.type}, fromMe: ${message.fromMe}, from: ${message.from}`);

      // Trampa global para llamadas perdidas
      if (message.type === 'call_log' || message.type === 'e2e_notification' || (message.body && message.body.includes('Llamada'))) {
         this.logger.log(`[OmniChat] Trampa de llamada activada. Tipo: ${message.type}. Enviando respuesta.`);
         try {
            await client.sendMessage(message.from, "Hola! Soy Julio 🤖. Ahorita las líneas telefónicas están saturadas y no puedo contestar llamadas de voz, pero escríbeme o mándame un audio por aquí y te atiendo al instante. ¡Soy todo oídos!");
         } catch(e) {}
         return;
      }

      if (message.fromMe) {
          await this.handleOutgoingPhoneMessage(companyId, message);
      }
    });

    client.on('call', async (call) => {
      this.logger.log(`[OmniChat] Llamada entrante detectada de ${call.from}`);
      
      if (call.from) {
         try {
            await client.sendMessage(call.from, "Hola! Soy Julio 🤖. Ahorita las líneas telefónicas están saturadas, pero escríbeme o mándame un audio por aquí y te atiendo al instante. ¡Soy todo oídos!");
         } catch (e) {
            this.logger.error("Error enviando mensaje de rechazo", e);
         }
      }

      try {
        await call.reject();
      } catch (err) {
        this.logger.error("Error rechazando llamada (Limitación de Meta Web)", err);
      }
    });

    try {
      await client.initialize();
      const sd = this.clients.get(companyId);
      if (sd) sd.client = client;
    } catch (e) {
      this.logger.error(`Error inicializando Client para ${companyId}`, e);
      const sd = this.clients.get(companyId);
      if (sd) sd.status = 'ERROR';
    }
  }

  async restartSession(companyId: string) {
    this.logger.warn(`Forzando reinicio de sesión WA para ${companyId}`);
    const data = this.clients.get(companyId);
    if (data && data.client) {
      try {
        await data.client.destroy();
      } catch (e) {}
    }
    this.clients.delete(companyId);

    const fs = require('fs');
    const sessionPath = `./.wwebjs_auth/session-${companyId}`;
    try {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      this.logger.log(`Carpeta de sesión ${sessionPath} eliminada por completo.`);
    } catch (e) {
      this.logger.error(`No se pudo eliminar ${sessionPath}`, e);
    }

    // Reiniciar
    this.startSession(companyId);
    return { success: true, message: 'Reinicio lanzado' };
  }

  async handleOutgoingPhoneMessage(companyId: string, message: any) {
    if (message.to.includes('@g.us') || message.isStatus || message.broadcast) return;

    let phone = message.to.replace('@c.us', '');
    let textBody = message.body ? message.body.trim() : '';
    if (!textBody && message.hasMedia) {
        textBody = '[Multimedia o Archivo enviado desde Celular]';
    }

    // Resolución de @lid (Problema común con Meta Cloud API)
    if (phone.includes('@lid')) {
        try {
            const waContact = await message.getContact();
            if (waContact && waContact.number) {
                phone = waContact.number;
                this.logger.log(`[OmniChat] @lid saliente resuelto a número real: ${phone}`);
            } else {
                return; // Ignoramos si no podemos obtener el número real
            }
        } catch(e) {
            return;
        }
    }

    // Bugfix: Bulletproof detector for self-addressed phantom messages
    const data = this.clients.get(companyId);
    const botPhone = data?.client?.info?.wid?.user || '';
    const cleanFrom = message.from ? message.from.split('@')[0].split(':')[0] : '';
    const cleanTo = phone; // Now resolved from @lid!
    
    if (cleanFrom.length >= 10 && cleanTo.length >= 10 && cleanFrom.slice(-10) === cleanTo.slice(-10)) {
        this.logger.log(`[OmniChat] Ignorando evento saliente rebotado a sí mismo (${cleanFrom} vs ${cleanTo})`);
        return;
    }
    
    if (botPhone && botPhone.length >= 10 && cleanTo.length >= 10 && cleanTo.slice(-10) === botPhone.slice(-10)) {
        this.logger.log(`[OmniChat] Ignorando evento saliente rebotado hacia el bot (${botPhone} vs ${cleanTo})`);
        return;
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
            data: { phone, name: 'Contacto (Desde Celular)', companyId, botStatus: 'PAUSED' }
        });
        
        // --- Sincronización Google Workspace ---
        try {
           const usersWithGoogle = await this.prisma.user.findMany({
              where: { companyId, googleAccessToken: { not: null } }
           });
           for (const user of usersWithGoogle) {
              this.googleService.syncContactToGoogle(user.id, contact.name || '', contact.phone).catch(() => {});
           }
        } catch (e) {
           this.logger.error("Error intentando sincronizar contacto con Google", e);
        }
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
            contactId: contact.id,
            timestamp: new Date(message.timestamp * 1000)
        }
    });

    // Animar la interfaz visual en tiempo real de OmniChat
    this.gateway.emitNewMessage({
       contactId: contact.id,
       message: savedMessage,
       pipeId: contact.pipelineId
    });

    this.logger.log(`[OmniChat-${companyId}] Mensaje saliente desde celular sincronizado: ${textBody}`);

    // === COMANDO SECRETO DE EMERGENCIA ===
    const lowerBody = textBody.toLowerCase();
    if (lowerBody.startsWith('!emergencia on')) {
       const extraText = textBody.substring('!emergencia on'.length).trim();
       const defaultMsg = "🚨 Hola, actualmente tenemos una falla general técnica en la zona. Nuestros técnicos ya están trabajando. Tiempo estimado de recuperación: 2 horas. Te pedimos una disculpa por el inconveniente.";
       const emergencyMessage = extraText.length > 0 ? extraText : defaultMsg;
       
       await this.prisma.company.update({
          where: { id: companyId },
          data: { emergencyMode: true, emergencyMessage }
       });
       this.logger.log(`[OmniChat-${companyId}] MODO EMERGENCIA ACTIVADO por WhatsApp: ${emergencyMessage}`);
    } else if (lowerBody.trim() === '!emergencia off') {
       await this.prisma.company.update({
          where: { id: companyId },
          data: { emergencyMode: false }
       });
       this.logger.log(`[OmniChat-${companyId}] MODO EMERGENCIA DESACTIVADO por WhatsApp`);
    }
    // =====================================
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

    let phone = message.from.replace('@c.us', '');
    
    // Resolución de @lid entrante
    if (phone.includes('@lid')) {
        try {
            const waContact = await message.getContact();
            if (waContact && waContact.number) {
                phone = waContact.number;
                this.logger.log(`[OmniChat] @lid entrante resuelto a número real: ${phone}`);
            } else {
                return;
            }
        } catch(e) {
            return;
        }
    }
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
        
        // --- Sincronización Google Workspace ---
        try {
           const usersWithGoogle = await this.prisma.user.findMany({
              where: { companyId, googleAccessToken: { not: null } }
           });
           for (const user of usersWithGoogle) {
              this.googleService.syncContactToGoogle(user.id, contact.name || '', contact.phone).catch(() => {});
           }
        } catch (e) {
           this.logger.error("Error intentando sincronizar contacto con Google", e);
        }
    }

    // =============== AUTO-REACTIVACIÓN (AUTO-CIERRE) ===============
    if (contact.botStatus === 'PAUSED' || contact.botStatus === 'RESOLVED') {
        const lastMsg = await this.prisma.message.findFirst({
            where: { contactId: contact.id },
            orderBy: { timestamp: 'desc' }
        });
        
        if (lastMsg) {
            const hoursSinceLastMsg = (Date.now() - lastMsg.timestamp.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastMsg >= 24) {
                this.logger.log(`[OmniChat] Auto-reactivando bot para ${phone} tras ${hoursSinceLastMsg.toFixed(1)}h de inactividad.`);
                contact = await this.prisma.contact.update({
                    where: { id: contact.id },
                    data: { botStatus: 'ACTIVE', pipelineId: null, assignedToId: null }
                });
                
                await this.prisma.contactNote.create({
                    data: {
                        text: `🤖 [SISTEMA] El chat se ha reabierto y el asistente virtual se ha reactivado automáticamente tras 24h de inactividad.`,
                        contactId: contact.id,
                        authorId: 'SYSTEM_BOT'
                    }
                });
            }
        }
    }
    // ===============================================================

    // =============== EMERGENCY MODE INTERCEPTOR ===============
    const currentCompany = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (currentCompany && currentCompany.emergencyMode && currentCompany.emergencyMessage) {
        // Prevent infinite loops and spamming the user if they keep typing
        const lastSent = await this.prisma.message.findFirst({
           where: { contactId: contact.id, fromMe: true },
           orderBy: { timestamp: 'desc' }
        });
        if (!lastSent || lastSent.body !== currentCompany.emergencyMessage) {
            await this.sendDirectMessage(companyId, phone, currentCompany.emergencyMessage);
        }
        return; // Detener flujo total. No IA, no Media Download, no Auto-Router.
    }
    // ==========================================================

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
            mediaType,
            timestamp: new Date(message.timestamp * 1000)
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

    // === NPS SURVEY INTERCEPTOR ===
    if (/^[1-5]$/.test(textBody)) {
       const pendingSurvey = await this.prisma.npsSurvey.findFirst({
          where: { contactId: contact.id, status: 'PENDING' }
       });

       if (pendingSurvey) {
          await this.prisma.npsSurvey.update({
             where: { id: pendingSurvey.id },
             data: { score: parseInt(textBody), status: 'COMPLETED' }
          });

          await this.prisma.contactNote.create({
             data: { text: `📊 Cliente respondió la encuesta NPS con calificación: ${textBody}/5`, contactId: contact.id, authorId: 'SYSTEM_BOT' }
          });

          const thankYouMsg = "¡Muchas gracias por tus comentarios! Nos ayudan a mejorar cada día. Que tengas un excelente día.";
          await this.sendDirectMessage(companyId, phone, thankYouMsg, contact.id);
          return; // Skip AI and routing, the survey is complete
       }
    }
    // ==============================

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
                  // Fix: Always use the resolved contact phone instead of the raw message.from to prevent @lid bounce loops
                  const targetJid = contact.phone.includes('@') ? contact.phone : `${contact.phone}@c.us`;
                  await this.sendDirectMessage(companyId, targetJid, aiResponse, contact.id);
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

            const targetJid = contact.phone.includes('@') ? contact.phone : `${contact.phone}@c.us`;
            await this.sendDirectMessage(companyId, targetJid, autoMsg, contact.id);
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

            const targetJid = contact.phone.includes('@') ? contact.phone : `${contact.phone}@c.us`;
            await this.sendDirectMessage(
                companyId,
                targetJid, 
                `✅ ¡Perfecto! Tu caso ha sido asignado al departamento de *${selectedPipe.name}*. Un técnico o asesor revisará tu caso y te contestará por aquí mismo muy pronto.`,
                contact.id
            );
            return;
        }

        const targetJid = contact.phone.includes('@') ? contact.phone : `${contact.phone}@c.us`;
        return this.sendBotMenu(companyId, targetJid, contact.id);
    }

    this.logger.log(`[OmniChat-${companyId}] Mensaje ruteado de ${phone}: ${textBody}`);
  }

  async sendBotMenu(companyId: string, targetPhone: string, contactId?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }});
    const menu = `👋 *¡Hola! Bienvenido a ${company?.name || 'nuestro servicio'}*\n\nSoy tu asistente de Inteligencia Artificial. ¿En qué te puedo apoyar o hacia qué departamento deseas que te comuniquemos el día de hoy?`;
    await this.sendDirectMessage(companyId, targetPhone, menu, contactId);
  }

  emitToInbox(contactId: string, message: any, pipeId: string | null) {
    this.gateway.emitNewMessage({ contactId, message, pipeId });
  }

  async sendDirectMessage(companyId: string, targetPhone: string, text: string, contactIdToSave?: string) {
    const data = this.clients.get(companyId);
    if (!data || data.status !== 'READY' || !data.client) {
      throw new Error(`[OmniChat] La sesión de WhatsApp de la empresa no está inicializada o conectada.`);
    }

    let finalTarget = targetPhone;

    // Normalize the target if it lacks the protocol
    if (!targetPhone.includes('@')) {
        targetPhone = `${targetPhone}@c.us`;
        finalTarget = targetPhone;
    }
    
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

    // Save locally to avoid UI blindness due to aggressive filters
    if (contactIdToSave) {
        try {
           const savedMsg = await this.prisma.message.create({
               data: { body: text, fromMe: true, contactId: contactIdToSave }
           });
           
           const contact = await this.prisma.contact.findUnique({ where: { id: contactIdToSave } });
           
           this.gateway.emitNewMessage({
               contactId: contactIdToSave,
               message: savedMsg,
               pipeId: contact?.pipelineId || null
           });
        } catch(e) {
           this.logger.error('Error guardando mensaje directo localmente', e);
        }
    }

    await data.client.sendMessage(finalTarget, text);
    return finalTarget;
  }

  async sendDirectMediaMessage(companyId: string, targetPhone: string, filePath: string) {
    const data = this.clients.get(companyId);
    if (!data || data.status !== 'READY' || !data.client) {
      throw new Error(`[OmniChat] La sesión de WhatsApp de la empresa no está inicializada o conectada.`);
    }
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(filePath);
    const finalTarget = targetPhone.includes('@') ? targetPhone : `${targetPhone}@c.us`;
    await data.client.sendMessage(finalTarget, media);
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
            let personalizedMsg = messageText.replace(/{name}/g, contact.name || 'cliente');
            
            // Inyección Dinámica de Excel Metadata (ISOTEC Solution)
            if (contact.metadata && typeof contact.metadata === 'object' && !Array.isArray(contact.metadata)) {
                const meta = contact.metadata as Record<string, any>;
                personalizedMsg = personalizedMsg.replace(/{metadata\.([^}]+)}/g, (match, key) => {
                    return meta[key] !== undefined ? String(meta[key]) : match;
                });
            }
            
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

  async syncHistoricalMessages(companyId: string) {
      const sd = this.clients.get(companyId);
      if (!sd || sd.status !== 'READY' || !sd.client) {
          throw new Error("El motor de WhatsApp no está listo para sincronizar.");
      }

      this.logger.log(`[OmniChat-${companyId}] Iniciando sincronización manual de historial en segundo plano...`);
      
      // Ejecutamos en segundo plano para evitar timeout HTTP
      setTimeout(async () => {
         try {
            const chats = await sd.client.getChats();
            let syncedCount = 0;
            let newContactsCount = 0;

      for (const chat of chats) {
          // Ignorar grupos y cuentas bloqueadas/anómalas
          if (chat.isGroup) continue;
          
          const phone = chat.id.user;
          // Ignorar cuentas de estado
          if (phone === 'status' || chat.id._serialized === 'status@broadcast') continue;

          try {
              const messages = await chat.fetchMessages({ limit: 500 });
              if (!messages || messages.length === 0) continue;

              let contact = await this.prisma.contact.findFirst({ where: { phone, companyId } });
              if (!contact) {
                  contact = await this.prisma.contact.create({
                      data: { 
                          phone, 
                          name: chat.name || 'Contacto Sincronizado', 
                          companyId,
                          botStatus: 'PAUSED'
                      }
                  });
                  newContactsCount++;
              }

              for (const msg of messages) {
                  if (msg.isStatus || msg.broadcast || msg.type === 'e2e_notification' || msg.type === 'call_log') continue;

                  let textBody = msg.body ? msg.body.trim() : '';
                  if (!textBody && msg.hasMedia) {
                      textBody = '[Multimedia o Archivo sincronizado]';
                  }

                  const timestamp = new Date(msg.timestamp * 1000);
                  
                  // Verificar duplicados considerando una ventana de tiempo de 10 segundos
                  const tenSecondsBefore = new Date(timestamp.getTime() - 10000);
                  const tenSecondsAfter = new Date(timestamp.getTime() + 10000);

                  const existingMsg = await this.prisma.message.findFirst({
                      where: {
                          contactId: contact.id,
                          fromMe: msg.fromMe,
                          body: textBody,
                          timestamp: {
                              gte: tenSecondsBefore,
                              lte: tenSecondsAfter
                          }
                      }
                  });

                  if (!existingMsg) {
                      await this.prisma.message.create({
                          data: {
                              body: textBody,
                              fromMe: msg.fromMe,
                              timestamp: timestamp,
                              contactId: contact.id
                          }
                      });
                      syncedCount++;
                  }
              }
          } catch (e: any) {
              this.logger.error(`[OmniChat-${companyId}] Error sincronizando chat ${phone}: ${e.message}`);
          }
      }

      this.logger.log(`[OmniChat-${companyId}] ✅ Sincronización Finalizada. Mensajes: ${syncedCount}, Nuevos contactos: ${newContactsCount}`);
      } catch(e: any) {
          this.logger.error(`[OmniChat-${companyId}] Error fatal en sincronización de historial: ${e.message}`);
      }
    }, 0);

    return { 
        syncedMessages: "Background", 
        newContacts: "Background",
        message: "La sincronización se está ejecutando en segundo plano. Los mensajes aparecerán pronto en tu bandeja."
    };
  }
}
