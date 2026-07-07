import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import axios from 'axios';
import { CryptoService } from '../crypto/crypto.service';
const computeCosineSimilarity = require('compute-cosine-similarity');

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService
  ) {}

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
        select: { openAiKey: true, openAiPrompt: true, name: true, apiKey: true, wisphubApiKey: true }
      });
      
      if (company) {
        company.openAiKey = this.crypto.decrypt(company.openAiKey) as any;
        company.wisphubApiKey = this.crypto.decrypt(company.wisphubApiKey) as any;
      }

      if (!company || !company.openAiKey) {
        this.logger.debug(`[AI] Abortando RAG para Company ${companyId}: No hay API Key configurada.`);
        return null;
      }

      const openai = new OpenAI({ apiKey: company.openAiKey });

      // 2. Recover Chat History (Últimas 24 horas para ahorrar tokens y reiniciar memoria)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const messageHistory = await this.prisma.message.findMany({
         where: { contactId, timestamp: { gte: twentyFourHoursAgo } },
         orderBy: { timestamp: 'desc' },
         take: 15
      });

      // Reverse to chronological order
      const orderedHistory = messageHistory.reverse();

      // 3. Lookup Tenant via HTTP to RentControl
      let tenantContextInfo = "";
      let contactPhone = 'Desconocido';
      try {
         const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
         if (contact && contact.phone) {
             contactPhone = contact.phone;
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

      const strictWispHubRules = `\n[REGLAS DE NEGOCIO Y ENRUTAMIENTO (¡MUY IMPORTANTE!): 1. Si el cliente pregunta por planes de internet, paquetes o cobertura, USA INMEDIATAMENTE la herramienta 'route_user_to_pipeline' con pipelineKeyword: 'Ventas-Radiotec' en esa misma respuesta. No esperes a que acabe la charla. 2. Si el cliente reporta un problema técnico grave (sin internet, foco rojo, lentitud), usa INMEDIATAMENTE 'route_user_to_pipeline' con pipelineKeyword: 'Soporte-Radiotec'. 3. Si estás recolectando datos para Internet (process_isp_installation_request), el teléfono debe tener 10 a 12 dígitos y el correo un '@'. 4. Si el último mensaje del historial fue un comprobante/factura enviada por nosotros, y el cliente responde "Gracias" o "Listo", despídete respondiendo ÚNICAMENTE con un emoji para no estorbar.]`;
      
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

      // --- RAFFLES CONTEXT ---
      let raffleContext = '';
      try {
          const activeRaffles = await this.prisma.raffle.findMany({
              where: { companyId, status: 'ACTIVE' },
              include: { tickets: { where: { contactId: contactId, status: 'RESERVED' } } }
          });
          
          if (activeRaffles.length > 0) {
             let pendingTicketsContext = "";
             for (const r of activeRaffles) {
                if (r.tickets && r.tickets.length > 0) {
                   pendingTicketsContext += `- Rifa "${r.name}": Boletos apartados [${r.tickets.map(t => t.ticketNumber).join(', ')}]. Total a pagar: $${r.tickets.length * r.ticketPrice}.\n`;
                }
             }

             raffleContext = `\n\n[CONTEXTO DE RIFAS ACTIVAS Y PAGOS:\nLa empresa tiene rifas activas. Si el cliente pregunta a dónde pagar, entrégale ESTOS DATOS EXACTOS Y PÍDELE LA FOTO DEL COMPROBANTE:\n- Banco: Banorte\n- CLABE: 072762006567799946\n- A nombre de: Jorge Hurtado Cota\n\n`;
             
             if (pendingTicketsContext) {
                 raffleContext += `⚠️ ¡IMPORTANTE! EL CLIENTE ACTUAL TIENE BOLETOS APARTADOS PENDIENTES DE PAGO:\n${pendingTicketsContext}\n`;
                 raffleContext += `REGLA DE ORO VIP PARA PAGOS DE BOLETOS:\n1) Si el cliente envía una imagen o foto, ASUME INMEDIATAMENTE que es el comprobante de pago de estos boletos. NO uses la herramienta 'verify_wisphub_receipt'.\n2) Responde con tono Premium, agradécele muchísimo su compra, dile que su comprobante se está procesando y que en unos breves minutos nuestro sistema le liberará automáticamente sus Boletos Digitales VIP.\n3) INMEDIATAMENTE ejecuta la herramienta 'route_user_to_pipeline' con pipelineKeyword: 'Validar' y reason: 'Envió comprobante de pago de Sorteo'. ¡Hazlo sentir muy especial!]\n`;
             } else {
                 raffleContext += `Tienes las siguientes rifas activas:\n`;
                 for (const r of activeRaffles) {
                    raffleContext += `- Rifa: ${r.name} (ID de Rifa: ${r.id}). Precio x Boleto: $${r.ticketPrice}.\n`;
                 }
                 raffleContext += `REGLA DE ORO RIFAS:\n1) Si un cliente escribe diciendo que acaba de apartar o reservar boletos desde la página web, dale la bienvenida calurosa a Sorteos Hurtado, dale los datos bancarios y pídele que envíe su comprobante.\n2) Si el cliente envía un comprobante de pago o foto, agradécele, dile que un administrador lo verificará y USA la herramienta 'route_user_to_pipeline' con pipelineKeyword 'Validar'. NUNCA digas que su pago ya fue validado automáticamente ni uses verify_wisphub_receipt.]\n`;
             }
          }
      } catch(e) {}

      const defaultPhoneInjection = `\n[El número de WhatsApp actual de este cliente con el que estás hablando es: ${contactPhone}. Úsalo como 'phone' por defecto si ejecutas herramientas y el cliente no te da uno diferente.]\n`;
      const personalityBaseline = `\n[INSTRUCCIÓN DE PERSONALIDAD: Te llamas 'Julio'. Tienes una personalidad hiper-humana, amigable, ingeniosa y empática (estilo mexicano relajado). 1) ESTÁ ESTRICTAMENTE PROHIBIDO usar frases robóticas, acartonadas o corporativas como "nuestro equipo de humanos les atenderá" o "un agente se pondrá en contacto". En su lugar usa lenguaje natural como "Ahorita te paso con uno de mis compañeros", "Enseguida le aviso a los chicos del taller", o "Dame chance y te conecto con un especialista". 2) Tienes excelente sentido del humor: Si el cliente te pide un chiste, DEBES contarle uno (preferiblemente de tecnología, ingenieros, internet o cosas de oficina) y reírte con ellos usando 'jajaja' o emojis. 3) Siéntete libre de tener conversaciones triviales breves si el cliente está aburrido.]\n`;
      const systemPrompt = (company.openAiPrompt || `Eres el recepcionista virtual experto de ${company.name}. Atiendes leads de manera corta, cortés y persuasiva por WhatsApp. Responde usando emojis moderadamente. Nunca inventes precios. Si no sabes, pide amablemente que esperen a un asesor humano. Sé conversacional, ¡nunca parezcas un bot rígido!`) + personalityBaseline + defaultPhoneInjection + tenantContextInfo + calendarContext + strictWispHubRules + currentTimeContext + ragContext + raffleContext;

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
              const filepath = path.join(process.cwd(), 'uploads', filename);

              if (fs.existsSync(filepath)) {
                  const base64Img = fs.readFileSync(filepath, { encoding: 'base64' });
                  let explicitText = incomingMessage.includes('[El cliente ha enviado una imagen adjunta]') 
                      ? 'Aquí tienes la imagen adjunta del cliente. Obsérvala y cotiza u opina según tus instrucciones:' 
                      : incomingMessage;
                  
                  finalMessageContent = [
                      { type: 'text', text: explicitText },
                      { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Img}` } }
                  ];
                  this.logger.log(`[AI-VISION] Imagen extraída de volumen persistente y parseada para GPT-4o.`);
              }
          } catch(err) {
              this.logger.error("Error cargando media local para AI Vision", err);
          }
      }

      messagesParams.push({ role: 'user', content: finalMessageContent });

      // Definir Herramientas (Function Calling)
      const tools: any[] = [
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
            description: "Clasifica y asigna al usuario a un departamento o columna específica (Embudo) dentro de Grupo Hurtado. Ejecútalo INMEDIATAMENTE en cuanto detectes la intención del usuario (Ej. si pide informes de internet envíalo a 'Ventas-Radiotec', si reporta fallas envíalo a 'Soporte-Radiotec', si es de RentControl a 'RentControl', si es de lavado a 'Lavado').",
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
            name: "close_lead_lost",
            description: "Cierra el chat y lo marca como Venta Perdida. Ejecútalo INMEDIATAMENTE si el cliente dice que ya no está interesado, que contrató a otro proveedor, que no tiene cobertura o que se cancela la compra. Despídete muy amablemente antes de ejecutarlo.",
            parameters: {
              type: "object",
              properties: {
                reason: { type: "string", description: "El motivo por el cual el cliente declinó (Ej. 'Ya contrató otro', 'Muy caro', 'No hay cobertura')." }
              },
              required: ["reason"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "check_rentcontrol_balance",
            description: "Consulta internamente la base de datos de los inquilinos de RentControl para saber si debe meses de renta o algún cargo. Úsalo SÓLO SI el cliente te pregunta cosas específicas sobre 'renta', 'departamento' o 'cuarto'. Si el cliente sólo dice 'estado de cuenta' o 'cuánto debo' y NO menciona renta, asume que es de Internet y usa la herramienta de WispHub en su lugar.",
            parameters: {
              type: "object",
              properties: {
                phone: { type: "string", description: "El número a 10 dígitos del cliente (Ej. 6421042123). Obtenlo del historial o solicítalo indirectamente si no está en tu memoria." }
              },
              required: ["phone"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "search_store_catalog",
            description: "Busca productos en la base de datos de la tienda (Catálogo local y Syscom) para verificar disponibilidad, precio o características. Úsalo cuando el cliente pregunte por un producto, modelo, existencias o cotización de equipos.",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string", description: "El término de búsqueda (ej. modelo, marca, categoría o nombre del producto)." }
              },
              required: ["query"]
            }
          }
        }
      ];

      // Add WispHub tools only if the company has the API Key configured
      if (company.wisphubApiKey) {
         tools.push(
            {
               type: "function",
               function: {
                  name: "verify_wisphub_receipt",
                  description: "Audita y valida un ticket de pago enviado por el cliente. Úsala ÚNICAMENTE cuando un cliente envíe una imagen que parezca un comprobante de pago/transferencia bancaria para pagar su mensualidad de internet.",
                  parameters: {
                     type: "object",
                     properties: {
                        folio: { type: "string", description: "El número de rastreo, autorización o folio de la transacción (Extrae solo los números principales)." },
                        amount: { type: "number", description: "El monto total de la transferencia o pago extraído del ticket (Ej. 350.00)." },
                        bank_name: { type: "string", description: "El nombre del banco al que se envió el dinero (Ej. Banorte, Azteca, Coppel, etc)." },
                        date: { type: "string", description: "La fecha en la que se realizó la transacción en formato YYYY-MM-DD (Ej. '2026-05-13')." },
                        phone: { type: "string", description: "El número a 10 dígitos del cliente (Ej. 6421042123). Obtenlo del historial o solicítalo indirectamente." }
                     },
                     required: ["folio", "amount", "bank_name", "date", "phone"]
                  }
               }
            },
            {
               type: "function",
               function: {
                  name: "check_wisphub_balance",
                  description: "Consulta la base de datos externa de WispHub para saber si un cliente debe su mensualidad de Internet. Úsalo SIEMPRE que un cliente con etiqueta WispHub o que pregunte por 'Internet' te diga '¿Cuánto debo?' o 'Quiero pagar el internet'.",
                  parameters: {
                     type: "object",
                     properties: {
                        phone: { type: "string", description: "El número a 10 dígitos del cliente (Ej. 6421042123). Obtenlo del historial o solicítalo indirectamente si no está en tu memoria." }
                     },
                     required: ["phone"]
                  }
               }
            },
            {
               type: "function",
               function: {
                  name: "check_wisphub_technical_status",
                  description: "Ejecuta un pre-diagnóstico técnico conectándose a WispHub. Úsalo SIEMPRE que un cliente reporte fallas de internet (lentitud, foco rojo, no conecta, sin servicio, internet caído).",
                  parameters: {
                     type: "object",
                     properties: {
                        phone: { type: "string", description: "El número a 10 dígitos del cliente (Ej. 6421042123). Obtenlo del historial o solicítalo indirectamente." }
                     },
                     required: ["phone"]
                  }
               }
            }
         );
      }


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
         let toolReturnContext: string | null = null;
         
         let args: any = {};
         try {
             args = JSON.parse(toolCall.function.arguments || '{}');
         } catch (parseError) {
             this.logger.warn(`[AI] Error parseando argumentos de la herramienta ${toolCall.function.name}: ${toolCall.function.arguments}`);
         }

         if (toolCall.function.name === "create_maintenance_ticket") {
            this.logger.log(`[AI-AGENT] Ejecutando 'create_maintenance_ticket' para Inquilino ${args.tenantId}`);
            
            try {
               const rcRes = await axios.post(`https://radiotecpro.com/api/integrations/omnichat/tickets/create`, args, {
                  headers: { 'x-api-key': process.env.OMNICHAT_WEBHOOK_SECRET || 'SUPER_SECRET_KEY_123' }
               });
               return `✅ ¡Entendido! Acabo de levantar el *Ticket #${rcRes.data.ticketId}* de Mantenimiento oficial en el sistema para tu departamento. Hemos notificado al propietario/gestor y un especialista revisará esto a la brevedad. ¿Hay algo más en lo que te pueda ayudar?`;
            } catch (err) {
               return "Lo siento, intenté registrar tu reporte de mantenimiento pero hubo un problema técnico en la nube. Un humano revisará este chat en breve.";
            }
         } else if (toolCall.function.name === "search_store_catalog") {
            this.logger.log(`[AI-AGENT] Ejecutando 'search_store_catalog' con query: ${args.query}`);
            try {
               // Consultar la API de la tienda (RentControl Store)
               const storeRes = await axios.get(`https://radiotecpro.com/api/store/products?search=${encodeURIComponent(args.query)}`);
               const products = storeRes.data.products || [];
               
               if (products.length === 0) {
                  toolReturnContext = `[SISTEMA INTERNO: La búsqueda de '${args.query}' no arrojó resultados. Dile al cliente que por el momento no encuentras ese equipo exacto, pero pregúntale si busca alguna alternativa o marca diferente.]`;
               } else {
                  // Tomar los primeros 3 resultados para no saturar el token limit
                  const topProducts = products.slice(0, 3).map((p: any) => {
                     // Formatear precio
                     const priceFormatted = `$${p.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN (o $${(p.price / (p.exchangeRate || 18.0)).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)`;
                     const stockInfo = p.stock > 0 ? `${p.stock} disponibles` : `Agotado / Sobre pedido`;
                     return `- ${p.title} (Marca: ${p.brand}, Modelo: ${p.model}). Precio: ${priceFormatted}. Inventario: ${stockInfo}`;
                  }).join('\n');
                  
                  toolReturnContext = `[SISTEMA INTERNO: Estos son los mejores resultados de la tienda para '${args.query}':\n${topProducts}\n\nCon esta información, responde al cliente de forma natural, persuasiva y concisa. Si hay existencias, anímalo a comprar. Si es sobre pedido, dale la opción de cotizar. NUNCA menciones que usaste un 'sistema interno'.]`;
               }
            } catch (err) {
               this.logger.error("Error buscando en catálogo", err);
               toolReturnContext = "[SISTEMA INTERNO: Ocurrió un error al conectar con el inventario de la tienda. Discúlpate amablemente y dile que verificarás la disponibilidad manualmente en un momento.]";
            }
         } else if (toolCall.function.name === "process_isp_installation_request") {
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
         } else if (toolCall.function.name === "verify_wisphub_receipt") {
            this.logger.log(`[AI-AGENT] Ejecutando 'verify_wisphub_receipt' para ${args.phone}. Folio: ${args.folio}`);
            
            try {
               // Función Helper Local para mover al cliente a Validar
               const moveToValidationAndAlert = async (reason: string, isPromesa: boolean, amountReceived: number, debtInfo: number) => {
                  let validacionPipe = await this.prisma.pipeline.findFirst({
                     where: { companyId: companyId, name: { contains: 'Validar', mode: 'insensitive' } }
                  });
                  if (!validacionPipe) {
                     validacionPipe = await this.prisma.pipeline.create({
                        data: { companyId: companyId, name: 'Pagos Por Validar', autoReply: '🤖 Tu pago está en revisión.' }
                     });
                  }
                  await this.prisma.contact.update({
                     where: { id: contactId },
                     data: { pipelineId: validacionPipe.id, botStatus: 'PAUSED' }
                  });
                  
                  const alertMsg = `🤖 *ALERTA OMNICHAT (Validación Manual Requerida)*\n\nHola Jorge, he recibido un ticket de *${contactPhone}* por $${amountReceived}.\n\n⚠️ *Motivo:* ${reason}\nDeuda Real: $${debtInfo}\n\n👉 Ya lo moví a '*${validacionPipe.name}*'. ${isPromesa ? 'Le apliqué una Promesa de Pago provisional.' : 'No modifiqué su servicio en WispHub.'}`;
                  try {
                     await axios.post(`http://localhost:3002/api/v1/messages/send`, {
                        phone: "5216421042123", text: alertMsg
                     }, { headers: { 'Authorization': `Bearer ${company.apiKey || ''}` } });
                  } catch(e) {}
               };

               // 1. Validar Duplicados (Folio)
               const existingReceipt = await this.prisma.paymentReceipt.findFirst({
                  where: { folio: args.folio, companyId: companyId }
               });
               if (existingReceipt) {
                  return `❌ El comprobante que enviaste con folio ${args.folio} ya fue registrado en nuestro sistema previamente. Por favor envía el comprobante actual de este mes.`;
               }

               // 2. Buscar Cliente en WispHub
               if (!company.wisphubApiKey) {
                  return `He recibido tu comprobante, pero los sistemas de cobro están en mantenimiento. Un asesor lo revisará manualmente.`;
               }

               let searchPhone = contactPhone.replace('+52', '').replace(/\s+/g, '');
               if (searchPhone.length > 10) searchPhone = searchPhone.slice(-10);

               const wispClientesRes = await axios.get(`https://api.wisphub.net/api/clientes/?telefono__icontains=${searchPhone}`, {
                   headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
               });

               if (!wispClientesRes.data || !wispClientesRes.data.results || wispClientesRes.data.results.length === 0) {
                   await moveToValidationAndAlert("Teléfono no encontrado en WispHub", false, args.amount, 0);
                   return `He recibido tu ticket por $${args.amount}, pero no logré vincular tu teléfono automáticamente. Un asesor lo revisará en breve.`;
               }

               const cliente = wispClientesRes.data.results[0];
               
               // 3. Buscar Facturas Pendientes
               const currentDate = new Date();
               const todayStrFetch = currentDate.toISOString().split('T')[0];
               const threeMonthsAgo = new Date();
               threeMonthsAgo.setMonth(currentDate.getMonth() - 3);
               const formattedDateStart = threeMonthsAgo.toISOString().split('T')[0];

               const facturasRes = await axios.get(`https://api.wisphub.net/api/facturas/?estado=1&fecha_emision__range_0=${formattedDateStart}&fecha_emision__range_1=${todayStrFetch}&cliente=${cliente.usuario}`, {
                   headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
               });

               let totalDeuda = 0;
               let facturas = facturasRes.data.results || [];
               facturas.forEach((f: any) => totalDeuda += parseFloat(f.total));

               if (facturas.length === 0) {
                  await moveToValidationAndAlert("Cliente envió comprobante pero no tiene facturas pendientes (Posible pago de Sorteo o nueva instalación)", false, args.amount, 0);
                  return `✅ He recibido tu comprobante por $${args.amount}. Nuestro sistema detecta que actualmente no tienes facturas pendientes de Internet. Si este pago es para apartar boletos de un Sorteo o para una nueva instalación, no te preocupes: un asesor revisará tu comprobante manualmente en breve para registrar tu pago.`;
               }

               // 4. Validar Fecha
               const todayStr = currentDate.toISOString().split('T')[0];
               const yesterday = new Date(currentDate);
               yesterday.setDate(yesterday.getDate() - 1);
               const yesterdayStr = yesterday.toISOString().split('T')[0];

               if (args.date !== todayStr && args.date !== yesterdayStr) {
                  await moveToValidationAndAlert(`Fecha del ticket parece vieja (${args.date})`, false, args.amount, totalDeuda);
                  return `He detectado la imagen de tu pago por $${args.amount}, pero la fecha del comprobante (${args.date}) parece antigua. Un asesor de finanzas revisará esto manualmente a la brevedad.`;
               }

               // 5. Validar Monto y Ejecutar
               const facturaTarget = facturas[0];

               if (parseFloat(args.amount) >= (totalDeuda * 0.95)) { // Tolerancia 5%
                   await this.prisma.paymentReceipt.create({
                      data: {
                         folio: args.folio, amount: parseFloat(args.amount), bank: args.bank_name, dateStr: args.date, contactId: contactId, companyId: companyId
                      }
                   });

                   try {
                       // Liquidar Factura Permanentemente (Forma Pago 1 = Efectivo/Transfer)
                       await axios.post(`https://api.wisphub.net/api/facturas/${facturaTarget.id_factura}/registrar-pago/`, {
                           referencia: `BOT_${args.folio}`,
                           fecha_pago: `${todayStr} 12:00`,
                           nombre_user: cliente.nombre,
                           forma_pago: 1,
                           comprobante_pago: `Auto-Liquidado por IA OmniChat`
                       }, {
                           headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
                       });

                       await this.prisma.contactNote.create({
                          data: { text: `🤖 [SISTEMA AI] PAGO LIQUIDADO DEFINITIVO.\nFolio: ${args.folio}\nMonto: $${args.amount}\nDeuda: $${totalDeuda}`, contactId, authorId: 'SYSTEM_BOT' }
                       });

                       // Alerta amigable directa a Jorge de éxito total (Sin mover pipeline)
                       const successAlertMsg = `🤖 *OMNICHAT AUTO-PAGO*\n\nHola Jorge, te informo que procesé automáticamente el pago de *${cliente.nombre}* por $${args.amount}.\n\n✅ Su factura fue **liquidada** en WispHub permanentemente.\n✅ No tienes que hacer nada, yo me encargo.`;
                       try {
                          await axios.post(`http://localhost:3002/api/v1/messages/send`, { phone: "5216421042123", text: successAlertMsg }, { headers: { 'Authorization': `Bearer ${company.apiKey || ''}` } });
                       } catch(ex) {}

                       return `✅ ¡Tu comprobante ha sido procesado exitosamente!\n\nTu factura ha quedado liquidada en nuestro sistema y tu internet está reactivado permanentemente. ¡Muchas gracias por tu pago y que tengas un excelente día! 🚀`;
                   } catch(e: any) {
                       this.logger.error("Error aplicando pago final en WispHub", e?.response?.data || e.message);
                       await moveToValidationAndAlert(`Fallo la API de WispHub al asentar el pago.`, false, args.amount, totalDeuda);
                       return `✅ He recibido tu comprobante por $${args.amount}. Un asesor de finanzas activará tu servicio manualmente en breve porque nuestros sistemas están lentos.`;
                   }
               } else {
                   // PAGO PARCIAL -> Promesa de Pago y Revisión Manual
                   const promesaLimit = new Date();
                   promesaLimit.setDate(promesaLimit.getDate() + 1);
                   try {
                       await axios.post(`https://api.wisphub.net/api/promesa-pago/`, { id_factura: facturaTarget.id_factura, fecha_limite: promesaLimit.toISOString().split('T')[0] }, { headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` } });
                       await moveToValidationAndAlert(`Pago Parcial/Insuficiente`, true, args.amount, totalDeuda);
                       return `He analizado tu ticket por $${args.amount}, pero tu deuda actual es de $${totalDeuda}. He activado tu internet temporalmente, pero un asesor se comunicará contigo para el ajuste.`;
                   } catch(e) {
                       await moveToValidationAndAlert(`Pago Parcial/Insuficiente (Falló promesa)`, false, args.amount, totalDeuda);
                       return `He analizado tu ticket por $${args.amount}, pero tu deuda actual es de $${totalDeuda}. He canalizado tu caso a finanzas.`;
                   }
               }
            } catch (e: any) {
               this.logger.error("Error validando receipt en AI", e?.response?.data || e.message);
               return "Recibí tu imagen, pero hubo un error en mis servidores. Un asesor te atenderá pronto.";
            }
         } else if (toolCall.function.name === "close_lead_lost") {
            this.logger.log(`[AI-AGENT] Marcando Lead como Venta Perdida. Razón: ${args.reason}`);
            
            try {
               await this.prisma.contact.update({
                  where: { id: contactId },
                  data: {
                     botStatus: 'RESOLVED',
                     tags: { push: 'VENTA_PERDIDA' }
                  }
               });

               await this.prisma.contactNote.create({
                  data: {
                     text: `🤖 [SISTEMA AI] Venta Perdida / Rechazo del Cliente.\nMotivo: ${args.reason}\nEl chat ha sido cerrado automáticamente.`,
                     contactId: contactId,
                     authorId: 'SYSTEM_BOT'
                  }
               });

               toolReturnContext = `[SISTEMA INTERNO: Has clasificado a este contacto como Venta Perdida y el sistema cerró el chat. Despídete de forma muy amable y profesional, deseándole éxito e indicando que quedamos a la orden para el futuro.]`;
            } catch(e) {
               this.logger.error("Error cerrando lead perdido", e);
               toolReturnContext = "[SISTEMA INTERNO: Error al cerrar chat.]";
            }
         } else if (toolCall.function.name === "route_user_to_pipeline") {
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
               toolReturnContext = `[SISTEMA INTERNO: Has clasificado y enrutado a este usuario a la columna exclusiva de *${targetPipeline.name}*. Ahora eres "Julio", despídete cordialmente y coméntale que lo dejarás en espera con ese departamento.]`;
            } catch(e) {
               this.logger.error("Error en router local de pipeline", e);
               toolReturnContext = "[SISTEMA INTERNO: Hubo un fallo en la base de datos clasificando a la persona. Despídete cordialmente y dile que un agente leerá el historial]";
            }
         } else if (toolCall.function.name === "schedule_appointment") {
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

               toolReturnContext = `[SISTEMA INTERNO: Has agendado exitosamente la cita en SQL para el servicio "${args.title}". Eres "Julio", infórmale al cliente que nuestro calendario está oficialmente separado y que los operativos están listos. ¡Habla muy natural y amable!]`;
            } catch(e) {
               this.logger.error("Error en Auto-Schedule de IA", e);
               toolReturnContext = "[SISTEMA INTERNO: Hubo un fallo guardando la cita en BD. Discúlpate y dile que un humano agendará de forma manual]";
            }
         } else if (toolCall.function.name === "schedule_followup_reminder") {
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
               
               await this.prisma.contactNote.create({
                  data: {
                     text: `🤖 [MEMORIA IA] He programado enviarle un mensaje de seguimiento especial a este cliente el día ${new Date(args.targetDateIso).toLocaleString()}.\n\n💬 Mensaje que le enviaré: "${args.reminderMessage}"`,
                     contactId: contactId,
                     authorId: 'SYSTEM_BOT'
                  }
               });

               return `De acuerdo, ¡agendado! El sistema te mandará nuestro mensaje el día acordado para retomar la plática. Quedamos a la orden. ✅`;
            } catch(e) {
               this.logger.error("Error guardando followup reminder", e);
               return "Claro, nos comunicamos ese día como lo indicas.";
            }
         } else if (toolCall.function.name === "escalate_to_human") {
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
                   toolReturnContext = `[SISTEMA INTERNO: No pude encontrar directamente al inquilino registrado con el teléfono terminado en ${args.phone.slice(-10)}. Por favor comunícalo al cliente educadamente y pide si tiene guardado otro teléfono]`;
               } else {
                   const tenant = resTenant.rows[0];
                   
                   const resCharges = await pgClient.query(`
                       SELECT type, amount, "dueDate" FROM "Charge" 
                       WHERE "leaseId" IN (SELECT id FROM "Lease" WHERE "tenantId" = $1)
                       AND status = 'PENDING'
                   `, [tenant.id]);
                   
                   await pgClient.end();
                   
                   if (resCharges.rows.length === 0) {
                       toolReturnContext = `[SISTEMA INTERNO: El inquilino ${tenant.name} fue encontrado pero NO tiene adeudos pendientes (saldo en ceros). Felicítalo educadamente y de forma muy natural.]`;
                   } else {
                       let adeudos = resCharges.rows.map((c: any) => `- ${c.type}: $${c.amount} MXN (Vence: ${new Date(c.dueDate).toLocaleDateString()})`).join("\n");
                       toolReturnContext = `[SISTEMA INTERNO: El inquilino ${tenant.name} TIENE ADEUDOS reales en RentControl:\n${adeudos}\nPor favor informale este desglose de forma amigable y natural]`;
                   }
               }
            } catch (ex: any) {
               this.logger.error("DB Err", ex.message);
               toolReturnContext = `[SISTEMA INTERNO: Falló la conexión técnica a RentControl. Discúlpate sutilmente y pide que espere a un humano]`;
            }
         } else if (toolCall.function.name === "check_wisphub_balance") {
            this.logger.log(`[AI-WISPHUB] Consultando saldo en WispHub para: ${args.phone}`);
            
            if (!company.wisphubApiKey) {
                this.logger.warn(`[AI-WISPHUB] Intento de consulta de saldo pero la empresa no tiene API Key de WispHub guardada.`);
                toolReturnContext = `[SISTEMA INTERNO: Como bot, acabo de notar que mi administrador no ha guardado la API Key de WispHub en el sistema. Por lo tanto, no puedo checar los saldos de internet ahora mismo. Discúlpate educadamente y dile al cliente que un humano atenderá su cobro en breve.]`;
            } else if (!args.phone) {
                toolReturnContext = `[SISTEMA INTERNO: No me proporcionaste un número de teléfono válido para buscar en la base de datos. Por favor pregúntale al cliente cuál es su número de teléfono registrado a 10 dígitos para poder buscar su saldo.]`;
            } else {
                try {
                   // Clean phone string to 10 digits
                   const searchPhone = String(args.phone).replace(/[^0-9]/g, '').slice(-10);
                   
                   // Fetch clients from WispHub by phone
                   const wispRes = await axios.get(`https://api.wisphub.net/api/clientes/?telefono=${searchPhone}`, {
                       headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
                   });
                   
                   if (wispRes.data && wispRes.data.results && wispRes.data.results.length > 0) {
                       const cliente = wispRes.data.results[0];
                       const nombre = cliente.nombre;
                       const estado = cliente.estado; // Ej. 'Activo', 'Suspendido'
                       const usuario = cliente.usuario;
                       
                       // Consultar facturas de los ultimos 3 meses
                       const today = new Date();
                       const threeMonthsAgo = new Date();
                       threeMonthsAgo.setMonth(today.getMonth() - 3);
                       const endStr = today.toISOString().split('T')[0];
                       const startStr = threeMonthsAgo.toISOString().split('T')[0];
                       
                       let numFacturas = 0;
                       let totalDeuda = 0;
                       
                       try {
                           const facturasRes = await axios.get(`https://api.wisphub.net/api/facturas/?cliente=${usuario}&estado=1&fecha_emision__range_0=${startStr}&fecha_emision__range_1=${endStr}`, {
                               headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
                           });
                           if (facturasRes.data && facturasRes.data.results) {
                               numFacturas = facturasRes.data.results.length;
                               totalDeuda = facturasRes.data.results.reduce((sum: number, f: any) => sum + f.total, 0);
                           }
                       } catch (err) {
                           this.logger.error("Error obteniendo facturas WispHub", err);
                       }
                       
                       if (numFacturas === 0) {
                           toolReturnContext = `[SISTEMA INTERNO: Encontré al cliente de WispHub '${nombre}'. Su estado actual de internet es '${estado}'. NO DEBE NADA (Saldo: $0). Felicítalo por estar al día y ofrécele ayuda con soporte técnico si lo requiere.]`;
                       } else {
                           toolReturnContext = `[SISTEMA INTERNO: Encontré al cliente de WispHub '${nombre}'. Eres Julio, Asistente Virtual. Dile exactamente esto con amabilidad y naturalidad: "Muy bien, veo que el servicio está a nombre de ${nombre}, su servicio está ${estado} pero tiene un adeudo de ${numFacturas} factura(s) que en total son $${totalDeuda} pesos. Para realizar tu pago de forma rápida y segura, o ver el detalle de tus recibos, por favor ingresa a tu Portal de Cliente aquí: https://clientes.portalinternet.net/panel/clientes/ . Tus datos de acceso son 👉 Usuario: ${usuario} | Contraseña: soporte1234" (NOTA: ESTÁ ESTRICTAMENTE PROHIBIDO USAR FORMATO MARKDOWN PARA EL LINK, PON LA URL PLANA DIRECTAMENTE) No le pidas ni le ofrezcas otros datos bancarios, siempre mándalo a su Portal de Cliente.]`;
                       }
                   } else {
                       toolReturnContext = `[SISTEMA INTERNO: No encontré a ningún cliente en WispHub registrado con el teléfono terminado en ${searchPhone}. Pídele cortésmente al cliente que te diga a nombre de quién está el contrato o si tiene otro teléfono registrado.]`;
                   }
                } catch (e: any) {
                   this.logger.error("Error consultando API WispHub", e);
                   toolReturnContext = `[SISTEMA INTERNO: Falló la conexión técnica a WispHub. Discúlpate sutilmente y dile al cliente que el sistema de finanzas está en mantenimiento y un humano le pasará el saldo en unos minutos]`;
                }
            }
         } else if (toolCall.function.name === "check_wisphub_technical_status") {
            this.logger.log(`[AI-WISPHUB] Consultando estado técnico en WispHub para: ${args.phone}`);
            
            if (!company.wisphubApiKey) {
                toolReturnContext = `[SISTEMA INTERNO: La empresa no tiene API Key de WispHub configurada. Discúlpate y avisa que un técnico humano revisará su caso pronto.]`;
            } else if (!args.phone) {
                toolReturnContext = `[SISTEMA INTERNO: No me proporcionaste un número de teléfono válido para buscar su estado técnico. Por favor pregúntale al cliente cuál es su número de teléfono a 10 dígitos para poder auditar su conexión.]`;
            } else {
                try {
                   const searchPhone = String(args.phone).replace(/[^0-9]/g, '').slice(-10);
                   const wispRes = await axios.get(`https://api.wisphub.net/api/clientes/?telefono=${searchPhone}`, {
                       headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
                   });
                   
                   if (wispRes.data && wispRes.data.results && wispRes.data.results.length > 0) {
                       const cliente = wispRes.data.results[0];
                       const estado = cliente.estado;
                       const nombre = cliente.nombre;
                       const usuario = cliente.usuario;
                       
                       // Consultar facturas de los ultimos 3 meses
                       const today = new Date();
                       const threeMonthsAgo = new Date();
                       threeMonthsAgo.setMonth(today.getMonth() - 3);
                       const endStr = today.toISOString().split('T')[0];
                       const startStr = threeMonthsAgo.toISOString().split('T')[0];
                       
                       let numFacturas = 0;
                       let totalDeuda = 0;
                       try {
                           const facturasRes = await axios.get(`https://api.wisphub.net/api/facturas/?cliente=${usuario}&estado=1&fecha_emision__range_0=${startStr}&fecha_emision__range_1=${endStr}`, {
                               headers: { 'Authorization': `Api-Key ${company.wisphubApiKey}` }
                           });
                           if (facturasRes.data && facturasRes.data.results) {
                               numFacturas = facturasRes.data.results.length;
                               totalDeuda = facturasRes.data.results.reduce((sum: number, f: any) => sum + f.total, 0);
                           }
                       } catch (err) {
                           this.logger.error("Error obteniendo facturas WispHub", err);
                       }
                       
                       if (estado.toLowerCase() === 'suspendido' || numFacturas > 0) {
                           toolReturnContext = `[SISTEMA INTERNO: Alerta. El cliente reportó una falla técnica pero en WispHub aparece como '${estado}' y debe ${numFacturas} facturas por un total de $${totalDeuda}. Esto no es una falla técnica, es un corte por falta de pago o adeudo. Como asistente virtual de la empresa (Julio), dile amablemente al cliente: "Muy bien, veo que el servicio está a nombre de ${nombre}, su servicio está ${estado} pero tiene un adeudo de ${numFacturas} factura(s) pendientes por un total de $${totalDeuda} pesos. Para restablecer tu servicio automáticamente, por favor ayúdanos a cubrir este saldo ingresando a tu Portal de Cliente en: https://clientes.portalinternet.net/panel/clientes/ . Tus datos de acceso son 👉 Usuario: ${usuario} | Contraseña: soporte1234" (NOTA: ESTÁ ESTRICTAMENTE PROHIBIDO USAR FORMATO MARKDOWN PARA EL LINK, PON LA URL PLANA DIRECTAMENTE) NUNCA LE OFREZCAS MANDAR TÉCNICOS NI DIAGNÓSTICO FÍSICO.]`;
                       } else if ((cliente.router && cliente.router.falla_general) || (cliente.sectorial && cliente.sectorial.falla_general)) {
                           const fallaLugar = (cliente.sectorial && cliente.sectorial.falla_general) ? cliente.sectorial.nombre : (cliente.router ? cliente.router.nombre : "tu zona");
                           const fallaDesc = (cliente.sectorial && cliente.sectorial.falla_general_descripcion) || (cliente.router && cliente.router.falla_general_descripcion) || "interrupción de energía/enlace";
                           toolReturnContext = `[SISTEMA INTERNO: Alerta. El cliente está activo y sin deudas, PERO su torre principal (${fallaLugar}) reporta FALLA GENERAL en WispHub. Eres Julio (el asistente virtual IA de RadioTec/RentControl). Dile al cliente: "Hemos detectado una falla general en la antena principal de tu zona (${fallaLugar}) debido a: ${fallaDesc}. Mis compañeros técnicos de campo ya están informados y trabajando para restablecer el servicio general a la brevedad. Te pedimos una sincera disculpa por el inconveniente." NO le pidas reiniciar su router, el problema es masivo.]`;
                       } else {
                           toolReturnContext = `[SISTEMA INTERNO: El cliente está '${estado}' y NO debe nada. Además, su torre principal no reporta ninguna falla general. Esto significa que la falla de internet es un PROBLEMA TÉCNICO INDIVIDUAL (router apagado, cable cortado o falla en la antena de su casa). Eres Julio (el asistente virtual). Pídele que revise si el foco LOS de su módem está parpadeando en rojo, o si ya desconectó el módem de la corriente por 1 minuto. IMPORTANTE: Dile que si después de hacer esto sigue sin internet, te avise diciendo "Ya lo hice y no funciona". Y si te dice eso, INMEDIATAMENTE ejecuta tu herramienta 'route_user_to_pipeline' con la palabra 'Soporte' para despachar a tus compañeros técnicos humanos a su domicilio.]`;
                       }
                   } else {
                       toolReturnContext = `[SISTEMA INTERNO: No encontré a ningún cliente en WispHub con el teléfono ${searchPhone}. Pídele al cliente el nombre del titular para buscarlo en el sistema y ayudarle con su falla.]`;
                   }
                } catch (e: any) {
                   this.logger.error("Error técnico WispHub", e);
                   toolReturnContext = `[SISTEMA INTERNO: Error de conexión con WispHub. Dile al cliente que estamos experimentando una interrupción del sistema interno y que un técnico leerá su mensaje en unos momentos.]`;
                }
            }
         } else {
             // Hallucinated tool
             this.logger.warn(`[AI] OpenAI intentó llamar a una función no programada: ${toolCall.function.name}`);
             toolReturnContext = `[SISTEMA INTERNO: Has intentado usar una herramienta técnica que no existe o está deshabilitada (${toolCall.function.name}). Por favor, dile al cliente amablemente que por el momento tus sistemas están actualizándose y que un humano le atenderá en breve.]`;
         }

         // FLUJO DE INTERCEPCIÓN ORGÁNICA
         if (toolReturnContext) {
             messagesParams.push(responseMessage); // Agregamos la request original de la Función
             messagesParams.push({
                 role: "tool",
                 tool_call_id: toolCall.id,
                 name: toolCall.function.name,
                 content: toolReturnContext
             });

             this.logger.log(`[AI-GENERATION] Re-inyectando resultado de ${toolCall.function.name} para generar respuesta orgánica.`);
             
             const secondCompletion = await openai.chat.completions.create({
                 model: "gpt-4o-mini",
                 messages: messagesParams,
                 temperature: 0.7,
                 max_tokens: 250
             });

             return secondCompletion.choices[0]?.message?.content?.trim() || null;
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
          if (company) company.openAiKey = this.crypto.decrypt(company.openAiKey) as any;
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

  /**
   * Resume los últimos mensajes de un chat para los agentes humanos (Copiloto IA)
   */
  async summarizeChat(companyId: string, contactId: string): Promise<string | null> {
      try {
          const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { openAiKey: true }});
          if (company) company.openAiKey = this.crypto.decrypt(company.openAiKey) as any;
          if (!company || !company.openAiKey) return null;
          
          const openai = new OpenAI({ apiKey: company.openAiKey });
          
          // Traer últimos 30 mensajes para el resumen
          const messageHistory = await this.prisma.message.findMany({
             where: { contactId },
             orderBy: { timestamp: 'desc' },
             take: 30
          });

          if (messageHistory.length === 0) return "No hay mensajes para resumir.";

          const chatText = messageHistory.reverse().map(m => `${m.fromMe ? 'NOSOTROS' : 'CLIENTE'}: ${m.body}`).join('\n');
          
          const response = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                  { role: "system", content: "Eres un asistente interno. Tu trabajo es leer el historial de chat provisto y hacer un resumen EJECUTIVO en máximo 3-4 líneas de cuál es el estatus o problema principal del cliente. El resumen es para que un agente humano lo lea rápido." },
                  { role: "user", content: `Resumen de este chat:\n\n${chatText}` }
              ],
              temperature: 0.3
          });
          
          return response.choices[0]?.message?.content?.trim() || "No se pudo generar el resumen.";
      } catch (err: any) {
          this.logger.error("Error generando resumen de chat", err.message);
          return null;
      }
  }
}

