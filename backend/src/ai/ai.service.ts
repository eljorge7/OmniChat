import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Genera una respuesta inteligente utilizando el historial del cliente y el Prompt de su Compañía
   * @param companyId El ID de la empresa dueña del hilo
   * @param contactId El ID del cliente (Contact)
   * @param incomingMessage El nuevo mensaje que disparó el evento
   * @returns El texto plano de la respuesta generada por OpenAI, o null si el bot no está activado
   */
  async generateResponse(companyId: string, contactId: string, incomingMessage: string): Promise<string | null> {
    try {
      // 1. Recover Company OpenAI Settings
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { openAiKey: true, openAiPrompt: true, name: true }
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
             const rcResponse = await axios.get(`http://localhost:3001/integrations/omnichat/identify/${contact.phone}`, {
                headers: { 'x-api-key': process.env.OMNICHAT_WEBHOOK_SECRET || 'SUPER_SECRET_KEY_123' }
             });
             
             this.logger.log(`[AI-AGENT] Respuesta RentControl: ${JSON.stringify(rcResponse.data)}`);
             if (rcResponse.data?.found && rcResponse.data?.hasActiveLease) {
                const t = rcResponse.data;
                tenantContextInfo = `\n[CONTEXTO INTERNO INVISIBLE: El usuario con el que hablas se llama ${t.name}. Es un INQUILINO ACTIVO. Vive en la unidad '${t.unitName}' de la propiedad '${t.propertyName}'. Su TenantID es '${t.tenantId}' y su UnitID es '${t.unitId}'. IMPORTANTE: Tienes a tu disposición la herramienta (Function Call) 'create_maintenance_ticket'. SI y SOLO SI el inquilino reporta un problema de mantenimiento físico (ej. fugas, daños, plomería, electricidad), DEBES ejecutar inmediatamente la función 'create_maintenance_ticket' para levantar su reporte. En caso de reportar un desperfecto, pregúntale los detalles básicos y usa la herramienta.]\n`;
                this.logger.log(`[AI-AGENT] Contexto inyectado en Prompt: ${t.name}`);
             } else {
                this.logger.log(`[AI-AGENT] Inquilino no encontrado o sin contrato activo.`);
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

      const systemPrompt = (company.openAiPrompt || `Eres el recepcionista virtual experto de ${company.name}. Atiendes leads de manera corta, cortés y persuasiva por WhatsApp. Responde usando emojis moderadamente. Nunca inventes precios. Si no sabes, pide amablemente que esperen a un asesor humano. Sé conversacional, ¡nunca parezcas un bot rígido!`) + tenantContextInfo + calendarContext;

      const messagesParams: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Insert previous history
      for (const msg of orderedHistory) {
         if (msg.body === incomingMessage && msg.fromMe === false) continue;
         messagesParams.push({
            role: msg.fromMe ? 'assistant' : 'user',
            content: msg.body
         });
      }

      // Add the final user message that just arrived
      messagesParams.push({ role: 'user', content: incomingMessage });

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
            name: "process_isp_installation_request",
            description: "Marca a un prospecto como 'Listo para Instalar' para un servicio de Internet. Ejecuta esta función SÓLO DESPUÉS de confirmar que el cliente subió foto de INE, Comprobante de Domicilio, un correo y número de teléfono. Avisa al humano que ya está completo.",
            parameters: {
              type: "object",
              properties: {
                planName: { type: "string", description: "El plan de Internet a contratar." },
                email: { type: "string" },
                phone: { type: "string", description: "Número de teléfono de contacto proporcionado." },
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
}
