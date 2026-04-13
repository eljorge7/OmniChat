import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import axios from 'axios';
const computeCosineSimilarity = require('compute-cosine-similarity');

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Genera una respuesta inteligente utilizando el historial del cliente y el Prompt de su Compañía
   * @param companyId El ID de la empresa dueña del hilo
   * @param contactId El ID del cliente (Contact)
   * @param incomingMessage El nuevo mensaje que disparó el evento
   * @param mediaUrl URL o path relativo del medio adjunto (opcional)
   * @param mediaType Tipo de medio (opcional)
   * @returns El texto plano de la respuesta generada por OpenAI, o null si el bot no está activado
   */
  async generateResponse(companyId: string, contactId: string, incomingMessage: string, mediaUrl?: string, mediaType?: string): Promise<string | null> {
    try {
      // 1. Recover Company OpenAI Settings
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { openAiKey: true, openAiPrompt: true, name: true, apiKey: true }
      });

      if (!company || !company.openAiKey) {
        this.logger.debug(`[AI] Abortando RAG para Company ${companyId}: No hay API Key configurada.`);
        return null;
      }

      const openai = new OpenAI({ apiKey: company.openAiKey });

      // 2. Recover Chat History (Last 10 messages)
      const messageHistory = await this.prisma.message.findMany({
         where: { contactId },
         orderBy: { timestamp: 'desc' },
         take: 10
      });

      // Reverse to chronological order
      const orderedHistory = messageHistory.reverse();

      // 3. Lookup Tenant via HTTP to RentControl
      let tenantContextInfo = "";
      try {
         const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
         if (contact && contact.phone) {
             this.logger.log(`[AI-AGENT] Buscando identidad de RentControl para el cel: ${contact.phone}`);
             const baseUrl = process.env.RENTCONTROL_API_URL || 'https://radiotecpro.com/api';
             const rcResponse = await axios.get(`${baseUrl}/integrations/omnichat/identify/${contact.phone}`, {
                headers: { 'x-api-key': process.env.OMNICHAT_WEBHOOK_SECRET || 'SUPER_SECRET_KEY_123' }
             });
             
             this.logger.log(`[AI-AGENT] Respuesta RentControl: ${JSON.stringify(rcResponse.data)}`);
             if (rcResponse.data?.found && rcResponse.data?.hasActiveLease) {
                const t = rcResponse.data;
                tenantContextInfo = `\n[CONTEXTO INTERNO INVISIBLE: El usuario con el que hablas se llama ${t.name}. Es un INQUILINO ACTIVO. Vive en la unidad '${t.unitName}' de la propiedad '${t.propertyName}'. Su TenantID es '${t.tenantId}' y su UnitID es '${t.unitId}'. \nDATOS FINANCIEROS ACTUALES: ${t.financialContext}\nIMPORTANTE: Si el cliente pregunta cuánto debe o si ya pasó su pago, respóndele basándote en los datos financieros anteriores de manera servicial. Tienes a tu disposición la herramienta (Function Call) 'create_maintenance_ticket'. SI y SOLO SI el inquilino reporta un problema de mantenimiento físico (ej. fugas, daños, plomería, electricidad), DEBES ejecutar inmediatamente la función 'create_maintenance_ticket' para levantar su reporte.]\n`;
                this.logger.log(`[AI-AGENT] Contexto inyectado en Prompt: ${t.name} - Deuda: ${t.financialContext}`);
             } else {
                this.logger.log(`[AI-AGENT] Inquilino no encontrado o sin contrato activo.`);
             }

             // --- CUSTOM TAGS (WISPHUB) ---
             if (contact.tags && contact.tags.length > 0) {
                 const hasWispHub = contact.tags.some(tag => tag.toLowerCase() === 'wisphub');
                 tenantContextInfo += `\n[INFORMACIÓN DE CONTACTO LOCAL: El cliente se llama '${contact.name}'. Sus etiquetas son: ${contact.tags.join(', ')}. `;
                 if (hasWispHub) {
                     tenantContextInfo += `IMPORTANTE: Tiene la etiqueta 'WispHub'. Asume inmediatamente que es tu cliente de Internet RadioTec. Si está reportando una falla técnica, asume que es de internet. SI EL CLIENTE ENVÍA UNA FOTO O IMAGEN que parezca un COMPROBANTE DE PAGO, tu trabajo es ejecutar inmediatamente la herramienta 'notify_admin_payment' para avisarle a Jorge. NO le hagas encuestas. Solo agrádecele el envío del pago y cierra el chat amablemente.]`;
                 }
                 tenantContextInfo += `]\n`;
             }
         }
      } catch(e: any) {
         this.logger.error(`No se pudo conectar con RentControl para extraer contexto: ${e.message}`);
      }

      // Fetch Next 7 Days Calendar Context
      let calendarContext = "";
      try {
         const today = new Date();
         const nextWeek = new Date();
         nextWeek.setDate(today.getDate() + 14); // Next 14 days
         
         const upcomingEvents = await this.prisma.calendarEvent.findMany({
             where: { companyId, startTime: { gte: today, lte: nextWeek } },
             orderBy: { startTime: 'asc' },
             select: { startTime: true, endTime: true }
         });

         calendarContext = `\n[AGENDA LOGÍSTICA (IMPORTANTE): Hoy es ${new Date().toLocaleString('es-MX')}. En los próximos 14 días, nuestro equipo humano YA TIENE OCUPADOS los siguientes bloques de tiempo: `;
         if(upcomingEvents.length === 0) calendarContext += "¡Nuestra agenda está totalmente libre y disponible toda la semana!";
         else calendarContext += upcomingEvents.map(e => `${e.startTime.toLocaleString('es-MX')} a ${e.endTime.toLocaleTimeString('es-MX')}`).join(" | ");
         calendarContext += ".\nNUNCA ofrezcas ni agendes citas que se empalmen con estos horarios ocupados. Ofrece horarios libres en la mañana (9am-1pm) o tarde (3pm-6pm) basándote en esta disponibilidad. Cuando acuerdes un horario libre y lugar con el cliente, USA LA HERRAMIENTA 'schedule_appointment' automáticamente para bloquear el calendario y despídete confirmando la fecha.]\n";
      } catch(e) { console.error(e) }

      const strictWispHubRules = `\n[REGLAS WISPHUB Y SOPORTE: 1. Si estás recolectando datos para Internet (process_isp_installation_request), NUNCA ejecutes la herramienta hasta que el teléfono tenga de 10 a 12 dígitos, y el correo contenga un '@'. Si están mal, PÍDESELOS DE NUEVO. 2. Si el cliente reporta un problema técnico grave (sin internet, foco rojo), usa INMEDIATAMENTE la herramienta 'route_user_to_pipeline' con pipelineKeyword: 'Soporte Urgente'. 3. (REGLA DE CONTEXTO SOCIAL IMPORTANTE): Si el último mensaje del historial fue un comprobante, alerta, factura de WispHub enviada por nosotros, y el cliente responde hoy solo con un "Gracias", "Listo", "Ok" o una confirmación cortés breve, ESTÁ PROHIBIDO responderle "Hola, ¿en qué te puedo ayudar?". En su lugar, despídete respondiendo ÚNICAMENTE con un emoji (ej. 👍 o 😊) para cerrar la charla sin estorbar.]`;
      
      const currentTimeContext = `\n[CONTEXTO TEMPORAL ACTUAL: El servidor donde habitas opera en Hora Local de Sonora (UTC-7). Hoy es **${new Date().toLocaleString('es-MX', { timeZone: 'America/Hermosillo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}**. SI el cliente te dice: "Hablamos el Lunes", o "Te aviso a las 8am", usa Inmediatamente la herramienta 'schedule_followup_reminder' fijando la fecha en formato ISO, y el sistema se encargará de reabrir el chat en ese momento por ti exacto.]\n`;

      // --- RAG KNOWLEDGE BASE (MEMORY FETCH) ---
      let ragContext = "";
      try {
        const chunks = await this.prisma.documentChunk.findMany({
           where: { document: { companyId } },
           select: { text: true, embedding: true, document: { select: { fileName: true } } }
        });

        if (chunks.length > 0) {
           const embResponse = await openai.embeddings.create({
             model: "text-embedding-ada-002",
             input: incomingMessage,
           });
           const questionVector = embResponse.data[0].embedding;

           const scoredChunks = chunks.map(chunk => {
             const score = computeCosineSimilarity(questionVector, chunk.embedding);
             return { score, text: chunk.text, source: chunk.document.fileName };
           });

           // Get top 3 chunks with score > 0.76
           const bestMatches = scoredChunks.filter(c => c.score > 0.76).sort((a,b) => b.score - a.score).slice(0, 3);
           
           if (bestMatches.length > 0) {
             ragContext = `\n\n[BASE DE CONOCIMIENTO (MANUALES INTERNOS):\nEl cliente podría estar preguntando algo sobre lo que tienes documentación. Aquí tienes extractos oficiales de los manuales de la empresa que son un MATCH semántico con la pregunta del cliente. Basa tu respuesta ESTRICTAMENTE en esta información si aplica a la duda:\n` + bestMatches.map(m => `--- Fuente: ${m.source} ---\n${m.text}`).join('\n\n') + `\nFIN BASE DE CONOCIMIENTO]\n`;
             this.logger.log(`[AI-AGENT] RAG Match encontrado! Se inyectaron ${bestMatches.length} fragmentos al prompt.`);
           }
        }
      } catch(e: any) {
        this.logger.error(`[AI-RAG] Error recuperando embeddings: ${e.message}`);
      }

      const systemPrompt = (company.openAiPrompt || `Eres el recepcionista virtual experto de ${company.name}. Atiendes leads de manera corta, cortés y persuasiva por WhatsApp. Responde usando emojis moderadamente. Nunca inventes precios. Si no sabes, pide amablemente que esperen a un asesor humano. Sé conversacional, ¡nunca parezcas un bot rígido!`) + tenantContextInfo + calendarContext + strictWispHubRules + currentTimeContext + ragContext;

      const messagesParams: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Insert previous history
      for (const msg of orderedHistory) {
         if (msg.body === incomingMessage && msg.fromMe === false) continue;
         messagesParams.push({
            role: msg.fromMe ? 'assistant' : 'user',
            content: msg.body || (msg.mediaUrl ? '[Archivo Histórico Omitido por Token Limits]' : '')
         });
      }

      // Add the final user message that just arrived (With Vision capabilities)
      let finalMessageContent: any = incomingMessage;

      if (mediaUrl && mediaType && mediaType.startsWith('image/')) {
          try {
              const fs = require('fs');
              const path = require('path');
              const filename = mediaUrl.split('/').pop();
              const filepath = path.join(__dirname, '..', '..', 'uploads', filename);

              if (fs.existsSync(filepath)) {
                  const base64Img = fs.readFileSync(filepath, { encoding: 'base64' });
                  finalMessageContent = [
                      { type: 'text', text: incomingMessage || '[El usuario adjuntó una imagen sin texto]' },
                      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Img}` } }
                  ];
                  this.logger.log(`[AI-VISION] Imagen decodificada y parseada para GPT-4o-mini.`);
              }
          } catch(err) {
              this.logger.error("Error cargando media local para AI Vision", err);
          }
      }

      messagesParams.push({ role: 'user', content: finalMessageContent });

      // Definir Herramientas (Function Calling)
      const tools = [
        {
          type: "function",
          function: {
            name: "create_maintenance_ticket",
            description: "Registra un ticket oficial de mantenimiento en el sistema cuando un inquilino reporta un problema físico en su unidad.",
            parameters: {
              type: "object",
              properties: {
                description: { type: "string", description: "Descripción detallada del problema que reporta el inquilino." },
                priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], description: "Nivel de urgencia deducido (Alta/Urgente para fugas o electricidad, Media/Baja para daños menores)." },
                tenantId: { type: "string", description: "El ID del inquilino (proveído en el Contexto del System Prompt)" },
                unitId: { type: "string", description: "El ID de la unidad (proveído en el Contexto del System Prompt)" }
              },
              required: ["description", "priority", "tenantId", "unitId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "notify_admin_payment",
            description: "Alerta directamente a Jorge (el administrador) que recibiste el comprobante del cliente. Úsala en cuanto un cliente te mande fotos de transferencias, tickets, o OXXO para sus mensualidades.",
            parameters: {
              type: "object",
              properties: {
                clientName: { type: "string", description: "El nombre aproximado del cliente (del contexto o historial)." },
                paymentSummary: { type: "string", description: "Breve descripción visual de la imagen: e.g. 'Comprobante BBVA de 450 MXN'." }
              },
              required: ["clientName", "paymentSummary"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "process_isp_installation_request",
            description: "Marca a un prospecto como 'Listo para Instalar' para un servicio de Internet. Ejecuta esta función SÓLO DESPUÉS de confirmar que el cliente subió foto de INE, Comprobante de Domicilio, un correo y número de teléfono. Avisa al humano que ya está completo.",
            parameters: {
              type: "object",
              properties: {
                planName: { type: "string", description: "El plan de Internet a contratar." },
                email: { type: "string", description: "Correo electrónico pilar, DEBE contener '@'." },
                phone: { type: "string", description: "Número de teléfono estricto de 10 o 12 dígitos, numérico." },
                summary: { type: "string", description: "Resumen breve de la recolección de documentos." }
              },
              required: ["planName", "email", "phone", "summary"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "route_user_to_pipeline",
            description: "Clasifica y asigna al usuario a un departamento o columna específica (Embudo) dentro de Grupo Hurtado. Ejecútalo SÓLO DESPUÉS de haber charlado, ofrecido los planes, o recabado la información (como IFE/INE, Problema Técnico). NUNCA LO EJECUTES DE INMEDIATO como telefonista de gobierno.",
            parameters: {
              type: "object",
              properties: {
                pipelineKeyword: { type: "string", description: "Una palabra clave corta del departamento al que quieres enviarlo, por ejemplo: 'RadioTec', 'RentControl', 'Lavado', 'Soporte', 'Ventas'" },
                reason: { type: "string", description: "Breve justificación de por qué fue enviado a esta columna." }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "schedule_appointment",
            description: "Agenda un servicio, instalación o cita en el calendario oficial de Grupo Hurtado. Ejecútalo EXACTAMENTE cuando el cliente y tú (IA) hayan pactado un día, una hora libre y la dirección donde se hará el trabajo.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título breve del servicio a agendar (Ej. 'Lavado Sala', 'Instalación Internet RadioTec')" },
                startDateIso: { type: "string", description: "Fecha y hora exacta de INICIO en formato estricto ISO 8601 local (Ej. '2026-04-03T10:00:00-06:00')" },
                endDateIso: { type: "string", description: "Fecha y hora exacta de TÉRMINO en formato estricto ISO 8601 (Normalmente 2 horas después del inicio)" },
                location: { type: "string", description: "La dirección exacta proporcionada por el cliente para enviar a los técnicos." },
                pipelineKeyword: { type: "string", description: "El departamento/embudo a cargo ('RadioTec', 'Lavado', 'RentControl')" }
              },
              required: ["title", "startDateIso", "endDateIso", "location", "pipelineKeyword"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "schedule_followup_reminder",
            description: "Programa un recordatorio cronológico. Úsalo cuando un cliente te ponga en pausa y te pida retomar la conversación más tarde, al día siguiente o la próxima semana (ej. 'hablamos el lunes a las 8am'). El servidor te despertará y enviará un mensaje automático por ti a esa hora.",
            parameters: {
              type: "object",
              properties: {
                targetDateIso: { type: "string", description: "La fecha y hora exacta ISO 8601 local (Ej. '2026-04-13T08:00:00-07:00') en la que el sistema contactará de vuelta al usuario." },
                reminderMessage: { type: "string", description: "El mensaje literal exacto con el que quieres saludar y retomar el tema (Ej. 'Hola Ariana, ¡buen inicio de semana! Retomando nuestra plática del sábado sobre tu instalación...')." }
              },
              required: ["targetDateIso", "reminderMessage"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "escalate_to_human",
            description: "Escala la conversación a un agente humano y detiene tus respuestas automáticas. Úsalo INMEDIATAMENTE si el cliente está muy enojado, frustrado, usa groserías o frases ofensivas, o si tú como IA no puedes resolver su problema grave. NUNCA DEBATAS CON UN CLIENTE ENOJADO.",
            parameters: {
              type: "object",
              properties: {
                reason: { type: "string", description: "Breve justificación de la emergencia (e.g. 'Cliente ofendiendo', 'Problema urgente fuera de mi alcance')." }
              },
              required: ["reason"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "check_rentcontrol_balance",
            description: "Consulta internamente la base de datos de los inquilinos de RentControl para saber si debe meses de renta o algún cargo. Úsalo SIEMPRE que te pregunten cosas como '¿Cuánto te debo de renta?' o 'Quiero pagar el departamento'.",
            parameters: {
              type: "object",
              properties: {
                phone: { type: "string", description: "El número a 10 dígitos del cliente (Ej. 6421042123). Obtenlo del historial o solicítalo indirectamente si no está en tu memoria." }
              },
              required: ["phone"]
            }
          }
        }
      ];

      // 4. Ping OpenAI API
      this.logger.log(`[AI] Solicitando Inferencia a OpenAI para Contact ${contactId}...`);
      
      const completion = await openai.chat.completions.create({
         model: "gpt-4o-mini", // Cost-effective, very capable
         messages: messagesParams,
         temperature: 0.7,
         max_tokens: 250, 
         tools: tools as any,
         tool_choice: "auto"
      });

      const responseMessage = completion.choices[0]?.message;

      // 5. Check if OpenAI wants to call a Function
      if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
         const toolCall: any = responseMessage.tool_calls[0];
         if (toolCall.function.name === "create_maintenance_ticket") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT] Ejecutando 'create_maintenance_ticket' para Inquilino ${args.tenantId}`);
            
            try {
               const rcRes = await axios.post(`http://localhost:3001/integrations/omnichat/tickets/create`, args, {
                  headers: { 'x-api-key': process.env.OMNICHAT_WEBHOOK_SECRET || 'SUPER_SECRET_KEY_123' }
               });
               return `✅ ¡Entendido! Acabo de levantar el *Ticket #${rcRes.data.ticketId}* de Mantenimiento oficial en el sistema para tu departamento. Hemos notificado al propietario/gestor y un especialista revisará esto a la brevedad. ¿Hay algo más en lo que te pueda ayudar?`;
            } catch (err) {
               this.logger.error("Error ejecutando webhook de ticket hacia RC", err);
               return "Lo siento, intenté registrar tu reporte de mantenimiento pero hubo un problema técnico en la nube. Un humano revisará este chat en breve.";
            }
         } else if (toolCall.function.name === "process_isp_installation_request") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT] Ejecutando 'process_isp_installation_request' para Contacto ${contactId}`);
            
            try {
               // Internal note for the team
               await this.prisma.contactNote.create({
                  data: {
                     text: `🤖 [SISTEMA] El cliente proporcionó todos los requisitos para instalar Internet.\nPlan: ${args.planName}\nTeléfono: ${args.phone}\nCorreo: ${args.email}\nResumen: ${args.summary}\n🚨 Listo para revisar fotos y dar de alta en WispHub.`,
                     contactId,
                     authorId: 'SYSTEM_BOT'
                  }
               });
               // Update flags
               await this.prisma.contact.update({
                  where: { id: contactId },
                  data: {
                     botStatus: 'PAUSED', // Pausar bot para que el humano agende instalación
                     tags: { push: 'LISTO_INSTALACION' }
                  }
               });

               return "✅ Excelente, ya tengo todos tus requerimientos. He notificado a un asesor para revisar tu información y agendar la fecha de instalación contigo en breve. ¡Un humano te responderá por este mismo chat pronto!";
            } catch(e) {
               this.logger.error("Error guardando datos de instalación", e);
               return "Lo siento, hubo un problema guardando tu solicitud, pero un asesor lo revisará manualmente en un momento.";
            }
         } else if (toolCall.function.name === "notify_admin_payment") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT] Ejecutando 'notify_admin_payment' para avisar de pago de ${args.clientName}`);
            
            try {
               await this.prisma.contactNote.create({
                  data: {
                     text: `🤖 [SISTEMA] Visión IA verificó un Comprobante de Pago.\nCliente: ${args.clientName}\nDetalles: ${args.paymentSummary}\nEl robot ha notificado al Administrador vía interna y movió al prospecto a 'Por Validar'.`,
                     contactId,
                     authorId: 'SYSTEM_BOT'
                  }
               });

               // Crear o Buscar la Columna "Por Validar"
               let validacionPipe = await this.prisma.pipeline.findFirst({
                  where: { companyId: companyId, name: { contains: 'Validar', mode: 'insensitive' } }
               });

               if (!validacionPipe) {
                  validacionPipe = await this.prisma.pipeline.create({
                     data: { companyId: companyId, name: 'Pagos Por Validar', autoReply: '🤖 Tu pago está siendo verificado.' }
                  });
               }

               // Mover al cliente a la columna Por Validar
               await this.prisma.contact.update({
                  where: { id: contactId },
                  data: { pipelineId: validacionPipe.id }
               });
               
               // La notificación "Mágica" vía disparo interno usando la API de OmniChat local hacia Jorge!
               const botAlertMessage = `🤖 *ALERTA OMNICHAT*\n\nHola Jorge, he detectado un comprobante de pago de *${args.clientName}*.\n\n📸 *Detalle Visión IA:* ${args.paymentSummary}\n\n👉 Ya moví al cliente a la columna '*${validacionPipe.name}*' en tu panel para que confirmes.`;

               try {
                  await axios.post(`http://localhost:3002/api/v1/messages/send`, {
                     phone: "5216421042123",
                     text: botAlertMessage
                  }, {
                     headers: { 'Authorization': `Bearer ${company.apiKey || ''}` }
                  });
               } catch(ex) {
                  this.logger.warn("No se pudo disparar el webhook de mensajes local a Jorge (Asegura tener ApiKey activa en Company).");
               }

               // Emitiremos el evento de gateway extra por si Jorge tiene la interfaz abierta,
               // además el Bot responderá cortésmente al cliente.
               return `¡Excelente! He recibido y analizado la captura de tu pago (${args.paymentSummary}). Acabo de notificar a Jorge de tu pago y a nuestra administración central para que verifiquen todo en sistema. Muchas gracias, ¡que tengas un gran día! ✅`;
            } catch(e) {
               this.logger.error("Error notificando al admin", e);
               return "He recibido tu comprobante, muchas gracias.";
            }
         } else if (toolCall.function.name === "route_user_to_pipeline") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT] Enrutando prospecto a Embudo: ${args.pipelineKeyword}`);
            
            try {
               const targetPipeline = await this.prisma.pipeline.findFirst({
                  where: { 
                     companyId: companyId,
                     name: { contains: args.pipelineKeyword, mode: 'insensitive' }
                  }
               });

               if (!targetPipeline) {
                  return `Me encantaría ayudarte a pasarte con el departamento de ${args.pipelineKeyword}, pero no encuentro ese canal activo en este momento. Un humano revisará tu mensaje en breve.`;
               }

               // Asignar al Embudo Local
               const currentContact = await this.prisma.contact.update({ 
                  where: { id: contactId },
                  data: { pipelineId: targetPipeline.id }
               });

               // Añadir nota de contexto
               await this.prisma.contactNote.create({
                  data: {
                     text: `🔄 [SISTEMA AI] El usuario fue aterrizado a la columna (Embudo) de ${targetPipeline.name} por el Conserje.\nJustificación: ${args.reason || 'Clasificación Automática'}`,
                     contactId: currentContact.id,
                     authorId: "SYSTEM_ROUTER"
                  }
               });

               // Importante: No detenemos a la IA silenciosamente, le anunciamos al cliente para que espere al especialista.
               return `✅ ¡Entendido! Te acabo de formar en la fila directa con los especialistas de *${targetPipeline.name}*. Permanece en este mismo chat, te atenderán en seguida.`;
            } catch(e) {
               this.logger.error("Error en router local de pipeline", e);
               return "Hubo un error técnico clasificando tu departamento, un humano leerá esto en breve.";
            }
         } else if (toolCall.function.name === "schedule_appointment") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT] Auto-Agendando Cita: ${args.title} en ${args.startDateIso}`);
            
            try {
               const targetPipeline = await this.prisma.pipeline.findFirst({
                  where: { companyId: companyId, name: { contains: args.pipelineKeyword, mode: 'insensitive' } }
               });

               await this.prisma.calendarEvent.create({
                  data: {
                     title: args.title,
                     startTime: new Date(args.startDateIso),
                     endTime: new Date(args.endDateIso),
                     location: args.location,
                     companyId: companyId,
                     contactId: contactId,
                     pipelineId: targetPipeline?.id || null
                  }
               });
               
               // Cambia el embudo si encontramos uno
               if(targetPipeline) {
                  await this.prisma.contact.update({ where: { id: contactId }, data: { pipelineId: targetPipeline.id }});
               }

               return `🗓️ ¡Hecho! He bloqueado nuestro calendario oficial para realizar tu servicio de *${args.title}*. Nos vemos en tu domicilio en la fecha acordada. Nuestro operativo humano de Grupo Hurtado checará tu archivo ahora para asegurar todo. ¡Pasa un gran día!`;
            } catch(e) {
               this.logger.error("Error en Auto-Schedule de IA", e);
               return "Lo lamento, hubo un error de sistema interno insertando tu cita en mi calendario cibernético, un humano tomará este reporte manualmente en breve. ¡Gracias por la espera!";
            }
         } else if (toolCall.function.name === "schedule_followup_reminder") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT] Agendando Recordatorio en Frío para: ${args.targetDateIso}`);
            
            try {
               await this.prisma.calendarEvent.create({
                  data: {
                     title: 'BOT_FOLLOWUP',
                     description: args.reminderMessage,
                     startTime: new Date(args.targetDateIso),
                     endTime: new Date(args.targetDateIso), // Same end time
                     location: 'OmniChat Auto-Responder Loop',
                     status: 'SCHEDULED', // Pending
                     companyId: companyId,
                     contactId: contactId
                  }
               });
               
               return `De acuerdo, ¡agendado! El sistema te mandará nuestro mensaje el día acordado para retomar la plática. Quedamos a la orden. ✅`;
            } catch(e) {
               this.logger.error("Error guardando followup reminder", e);
               return "Claro, nos comunicamos ese día como lo indicas.";
            }
         } else if (toolCall.function.name === "escalate_to_human") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`🚨 [AI-AGENT-SENTIMENT] Escalado de Emergencia. Razón: ${args.reason}`);
            try {
               await this.prisma.contact.update({
                  where: { id: contactId },
                  data: { botStatus: 'PAUSED', tags: { push: "Emergencia 🚨" } }
               });
               
               await this.prisma.contactNote.create({
                  data: {
                     text: `🚨 [ESCALADO DE EMERGENCIA] La Inteligencia Artificial pausó el bot porque detectó nivel alto de enojo o urgencia crítica.\nMotivo deductivo: ${args.reason}`,
                     contactId,
                     authorId: 'SYSTEM_BOT'
                  }
               });
               return `Comprendo totalmente tu molestia. He pausado mis respuestas automáticas de inmediato y acabo de alertar directamente a nuestro departamento médico/gerencial para que un humano lea el chat y te resuelva personalmente. Por favor dame unos minutos.`;
            } catch (e) {
               this.logger.error("Error al escalar a humano", e);
               return "Un especialista humano va a revisar tu caso en un momento.";
            }
         } else if (toolCall.function.name === "check_rentcontrol_balance") {
            const args = JSON.parse(toolCall.function.arguments);
            this.logger.log(`[AI-AGENT-RENTCONTROL] Verificando balances SQL para: ${args.phone}`);
            try {
               const { Client } = require('pg');
               const rentcontrolDbUrl = "postgresql://admin:admin123@172.17.0.1:5432/rentcontrol?schema=public";
               const pgClient = new Client({ connectionString: rentcontrolDbUrl });
               await pgClient.connect();
               
               // Buscar al Tenant en la otra DB
               const searchPhone = `%${args.phone.slice(-10)}%`;
               const resTenant = await pgClient.query(`SELECT id, name FROM "Tenant" WHERE phone LIKE $1 LIMIT 1`, [searchPhone]);
               
               if (resTenant.rows.length === 0) {
                   await pgClient.end();
                   const invisibleContext = `[ESTO NO ES UN TEXTO AL USUARIO, ES CONTEXTO PARA TI: No pude encontrar directamente al inquilino en RentControl registrado con el teléfono terminado en ${args.phone.slice(-10)}. Por favor dile al cliente educadamente que no encuentras su perfil y pídele que compruebe si tiene guardado otro teléfono principal con nosotros.]`;
                   return invisibleContext;
               }
               
               const tenant = resTenant.rows[0];
               
               // Buscar saldos pendientes cruzados en 'Charge' y 'Lease'
               const resCharges = await pgClient.query(`
                   SELECT type, amount, "dueDate" FROM "Charge" 
                   WHERE "leaseId" IN (SELECT id FROM "Lease" WHERE "tenantId" = $1)
                   AND status = 'PENDING'
               `, [tenant.id]);
               
               await pgClient.end();
               
               if (resCharges.rows.length === 0) {
                   return `[CONTEXTO: El inquilino ${tenant.name} fue encontrado en RentControl pero NO tiene ningún adeudo pendiente, está totalmente al día y su saldo en ceros. Felicítalo educadamente y ponle carita feliz.]`;
               }
               
               let adeudos = resCharges.rows.map((c: any) => `- Concepto ${c.type}: $${c.amount} MXN (Vencimiento: ${new Date(c.dueDate).toLocaleDateString()})`).join("\n");
               return `[CONTEXTO: El inquilino ${tenant.name} TIENE ADEUDOS pendientes reales de RentControl:\n${adeudos}\nPor favor informale este desglose natural y amablemente diciéndole que este sistema arrojó su estado de cuenta total.]`;
            } catch (ex: any) {
               this.logger.error("Error consultando la base de datos transversal de rentcontrol", ex.message);
               return `[CONTEXTO: Hubo un error de conexión con los túneles SQL de RentControl. Finge demencia, discúlpate por fallas de mi sistema y dile que espere mientras lo checamos manual.]`;
            }
         }
      }

      // 6. Normal text response
      const responseText = responseMessage?.content?.trim();

      if (!responseText) {
         this.logger.error(`[AI] OpenAI retornó un payload vacío.`);
         return null;
      }

      return responseText;

    } catch (error) {
       this.logger.error(`[AI] Falla crítica en inferencia: ${error instanceof Error ? error.message : "Desconocido"}`);
       return null;
    }
  }

  /**
   * Fase 1: Transcripción Automática de Voz (OpenAI Whisper)
   */
  async transcribeAudio(filepath: string, companyId: string): Promise<string | null> {
      try {
          const fs = require('fs');
          if (!fs.existsSync(filepath)) return null;
          
          const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { openAiKey: true }});
          if (!company || !company.openAiKey) return null;
          
          const openai = new OpenAI({ apiKey: company.openAiKey });
          
          this.logger.log(`[AI-WHISPER-${companyId}] Detectado mensaje de voz/ptt. Enviando a Whisper API...`);
          const response = await openai.audio.transcriptions.create({
              file: fs.createReadStream(filepath),
              model: 'whisper-1',
              language: 'es'
          });
          
          this.logger.log(`[AI-WHISPER] Transcripción Exitosa: "${response.text.substring(0, 50)}..."`);
          return response.text;
      } catch (err: any) {
          this.logger.error("Error catastrofico interceptando API de Whisper", err.message);
          return null;
      }
  }
}

