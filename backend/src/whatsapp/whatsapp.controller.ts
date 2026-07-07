import { Controller, Get, Post, Body, Put, UseInterceptors, UploadedFile, BadRequestException, Param, Delete, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { CaptureWebLeadDto } from './dto/capture-web-lead.dto';
import axios from 'axios';
import { CryptoService } from '../crypto/crypto.service';
import { AiService } from '../ai/ai.service';

@Controller('api/inbox')
export class WhatsappController {
  constructor(
    private prisma: PrismaService, 
    private whatsapp: WhatsappService,
    private crypto: CryptoService,
    private ai: AiService
  ) {}

  @Get('stats')
  async getDashboardStats() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const totalLeads = await this.prisma.contact.count();
    const unassigned = await this.prisma.contact.count({ where: { pipelineId: null } });
    
    const activeChatsToday = await this.prisma.message.groupBy({
       by: ['contactId'],
       where: { timestamp: { gte: today } }
    });
    const totalPipelines = await this.prisma.pipeline.count();

    return { totalLeads, unassigned, todayChats: activeChatsToday.length, totalPipelines };
  }

  @Get('qr')
  async getQrStatus() {
    const company = await this.prisma.company.findFirst({
        where: { name: { contains: 'hurtado', mode: 'insensitive' } }
    });
    if (!company) return { qr: '', status: 'NOT_STARTED' };
    
    let data = this.whatsapp.getQrCode(company.id);
    if (data.status === 'NOT_STARTED') {
       this.whatsapp.startSession(company.id); // Auto-arranque de Grupo Hurtado
       data.status = 'INITIALIZING';
    }
    return data;
  }

  @Post('qr/reset')
  async resetQrSession() {
    const company = await this.prisma.company.findFirst({
        where: { name: { contains: 'hurtado', mode: 'insensitive' } }
    });
    if (!company) throw new BadRequestException("No company found");
    return this.whatsapp.restartSession(company.id);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') contactId: string) {
      await this.prisma.contact.update({
          where: { id: contactId },
          data: { unreadCount: 0 }
      });
      return { success: true };
  }

  @Get('qr/:companyId')
  async getQrStatusForCompany(@Param('companyId') companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return { qr: '', status: 'NOT_STARTED' };
    
    let qrData = this.whatsapp.getQrCode(company.id);
    if (qrData.status === 'NOT_STARTED') {
       this.whatsapp.startSession(company.id); // Lanza el motor bajo demanda
       qrData.status = 'INITIALIZING';
    }
    return qrData;
  }

  @Get()
  async getInboxData(@Query('companyId') companyId?: string) {
    let targetCompanyId = companyId;
    if (!targetCompanyId) {
       const firstCompany = await this.prisma.company.findFirst();
       if (!firstCompany) return { pipelines: [], chats: [] };
       targetCompanyId = firstCompany.id;
    }

    // 1. Obtener todos los Pipelines (Embudos) de la empresa actual
    const pipelines = await this.prisma.pipeline.findMany({
      where: { companyId: targetCompanyId },
      orderBy: { createdAt: 'asc' }
    });

    // 2. Obtener los Contactos asignados con sus últimos mensajes y notas internas
    const contacts = await this.prisma.contact.findMany({
      where: { companyId: targetCompanyId },
      include: {
        notes: {
          orderBy: { createdAt: 'asc' }
        },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 50, // Traemos el historial reciente para el chat
        },
        assignedTo: {
          select: { id: true, name: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Formatear la respuesta exacta que necesita el Frontend (Next.js)
    const formattedChats = contacts.map(c => ({
      id: c.id,
      name: c.name || c.phone,
      phone: c.phone,
      lastMessage: c.messages[0]?.body || 'Sin mensajes', 
      time: c.messages[0]?.timestamp.toISOString() || '',
      unread: c.unreadCount || 0,
      pipeId: c.pipelineId,
      departmentId: c.departmentId,
      pipelineStageId: c.pipelineStageId,
      botStatus: c.botStatus,
      tags: c.tags || [],
      notes: c.notes || [],
      assignedTo: c.assignedTo || null,
      messages: c.messages.reverse()
    }));

    const departments = await this.prisma.department.findMany({
      where: { companyId: targetCompanyId },
      include: {
        pipelines: {
          include: {
            stages: { orderBy: { order: 'asc' } }
          }
        }
      }
    });

    // Retrocompatibilidad: Mapear pipelines con nombre del departamento para el frontend actual
    const compatPipelines = pipelines.map(p => {
      const dept = departments.find(d => d.id === p.departmentId);
      return {
        ...p,
        name: dept ? `${dept.name} - ${p.name}` : p.name
      };
    });

    return {
      pipelines: compatPipelines, // Para Frontend Actual
      departments, // Para Nuevo Frontend Kanban
      chats: formattedChats
    };
  }

  @Post('bot/pipelines')
  async updatePipelines(@Body() body: { pipelines: any[] }) {
    for (const pipe of body.pipelines) {
      await this.prisma.pipeline.update({
        where: { id: pipe.id },
        data: {
          name: pipe.name,
          keywords: pipe.keywords,
          autoReply: pipe.autoReply
        }
      });
    }
    return { success: true };
  }

  @Post('bot/pipelines/create')
  async createPipeline(@Body() body: { name: string, companyId: string }) {
    if (!body.name || !body.companyId) throw new BadRequestException("Faltan datos para crear el embudo");
    return this.prisma.pipeline.create({
      data: {
        name: body.name,
        companyId: body.companyId
      }
    });
  }

  @Delete('bot/pipelines/:id')
  async deletePipeline(@Param('id') id: string) {
    // Si hay contactos en este embudo, los regresaremos a "Sin Asignar" (pipelineId = null)
    await this.prisma.contact.updateMany({
      where: { pipelineId: id },
      data: { pipelineId: null }
    });

    return this.prisma.pipeline.delete({
      where: { id }
    });
  }

  // --- AI RAG CONFIGURATION ---
  @Get('bot/config')
  async getAiConfig(@Query('companyId') companyId?: string) {
    let company;
    if (companyId) {
      company = await this.prisma.company.findUnique({ where: { id: companyId }});
    } else {
      company = await this.prisma.company.findFirst();
    }
    if (!company) throw new BadRequestException("Empresa no encontrada");
    
    return {
       openAiKey: this.crypto.decrypt(company.openAiKey) || "",
       openAiPrompt: company.openAiPrompt || ""
    };
  }

  @Post('bot/config')
  async updateAiConfig(@Body() body: { companyId?: string, openAiKey: string, openAiPrompt: string }) {
    let company;
    if (body.companyId) {
      company = await this.prisma.company.findUnique({ where: { id: body.companyId }});
    } else {
      company = await this.prisma.company.findFirst();
    }
    if (!company) throw new BadRequestException("Empresa no encontrada");
    
    await this.prisma.company.update({
       where: { id: company.id },
       data: {
         openAiKey: body.openAiKey?.trim() ? this.crypto.encrypt(body.openAiKey.trim()) : null,
         openAiPrompt: body.openAiPrompt || null
       }
    });

    return { success: true, message: "Cerebro IA actualizado" };
  }

  // --- WISPHUB INTEGRATION CONFIGURATION ---
  @Get('bot/wisphub-config')
  async getWisphubConfig(@Query('companyId') companyId?: string) {
    let company;
    if (companyId) {
      company = await this.prisma.company.findUnique({ where: { id: companyId }});
    } else {
      company = await this.prisma.company.findFirst();
    }
    if (!company) throw new BadRequestException("Empresa no encontrada");
    
    const decryptedKey = this.crypto.decrypt(company.wisphubApiKey);
    return {
       wisphubApiKey: decryptedKey ? "********" + decryptedKey.slice(-4) : ""
    };
  }

  @Post('bot/wisphub-config')
  async updateWisphubConfig(@Body() body: { companyId?: string, wisphubApiKey: string }) {
    let company;
    if (body.companyId) {
      company = await this.prisma.company.findUnique({ where: { id: body.companyId }});
    } else {
      company = await this.prisma.company.findFirst();
    }
    if (!company) throw new BadRequestException("Empresa no encontrada");
    
    await this.prisma.company.update({
       where: { id: company.id },
       data: {
         wisphubApiKey: body.wisphubApiKey?.trim() ? this.crypto.encrypt(body.wisphubApiKey.trim()) : null
       }
    });

    return { success: true, message: "Llave de WispHub actualizada con éxito" };
  }

  @Post('assign')
  async assignContact(@Body() body: { contactId: string, pipelineId: string }) {
    const updated = await this.prisma.contact.update({
      where: { id: body.contactId },
      data: { pipelineId: body.pipelineId },
      include: { company: true }
    });

    if (body.pipelineId) {
       const pipeline = await this.prisma.pipeline.findUnique({ where: { id: body.pipelineId } });
       if (pipeline) {
           const pipeName = pipeline.name.toLowerCase();
           
           if (pipeName.includes('resuelto')) {
              // Send NPS Survey
              const existingSurvey = await this.prisma.npsSurvey.findFirst({
                 where: { contactId: body.contactId, status: 'PENDING' }
              });

              if (!existingSurvey) {
                 await this.prisma.npsSurvey.create({
                    data: {
                       contactId: body.contactId,
                       companyId: updated.companyId,
                       status: 'PENDING'
                    }
                 });

                 const surveyText = `Hola, acabamos de cerrar tu reporte/instalación. Nos encantaría saber cómo fue tu experiencia. Del 1 al 5, ¿qué calificación le das a nuestra atención? (Siendo 5 excelente y 1 mala)`;
                 await this.whatsapp.sendDirectMessage(updated.companyId, updated.phone, surveyText);
                 
                 await this.prisma.contactNote.create({
                     data: { text: `📊 Encuesta NPS enviada automáticamente al cliente.`, contactId: updated.id, authorId: 'SYSTEM_BOT' }
                 });
              }
           } else if (pipeName.includes('instalado') || pipeName.includes('instalaciones')) {
              // Automatic Onboarding
              let usernameWisp = 'No Encontrado';
              const decryptedWispKey = this.crypto.decrypt(updated.company.wisphubApiKey);
              if (decryptedWispKey) {
                 let searchPhone = updated.phone.replace('+52', '').replace(/\s+/g, '');
                 if (searchPhone.length > 10) searchPhone = searchPhone.slice(-10);

                 try {
                     const res = await axios.get(`https://api.wisphub.net/api/clientes/?telefono__icontains=${searchPhone}`, {
                         headers: { 'Authorization': `Api-Key ${decryptedWispKey}` }
                     });
                     if (res.data && res.data.results && res.data.results.length > 0) {
                         usernameWisp = res.data.results[0].usuario;
                     }
                 } catch(e) {
                     // Silencioso
                 }
              }

              const welcomeText = `🎉 ¡Felicidades por tu nueva instalación, ${updated.name || 'cliente'}! Bienvenido a la familia RadioTec.\n\nA partir de hoy, tienes el control total de tu servicio. Puedes consultar tus recibos, pagar en línea o descargar tus facturas desde tu Portal de Cliente:\n🌐 Link: https://clientes.portalinternet.net/panel/clientes/\n👤 Usuario: ${usernameWisp}\n🔑 Contraseña temporal: soporte1234\n\nPara cualquier duda, puedes escribirnos por este mismo medio las 24 hrs. ¡Que disfrutes tu navegación a máxima velocidad! 🚀`;
              
              await this.whatsapp.sendDirectMessage(updated.companyId, updated.phone, welcomeText);
              
              await this.prisma.contactNote.create({
                  data: { text: `🎉 Mensaje de Onboarding de bienvenida enviado al cliente (Usuario WispHub: ${usernameWisp}).`, contactId: updated.id, authorId: 'SYSTEM_BOT' }
              });
           }
       }
    }

    return updated;
  }

  // --- AGENT ASSIGNMENT ---

  @Get('agents/:companyId')
  async getCompanyAgents(@Param('companyId') companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true }
    });
  }

  @Post('agents/create')
  async createAgent(@Body() body: { companyId: string, name: string, email: string, password: string, role: string }) {
    if(!body.companyId || !body.email || !body.password) throw new BadRequestException("Faltan datos");
    
    // Validar duplicidad
    const existing = await this.prisma.user.findUnique({ where: { email: body.email }});
    if(existing) throw new BadRequestException("El correo ya está registrado en este ecosistema.");

    const newUser = await this.prisma.user.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        email: body.email,
        password: body.password, // En MVP usamos texto plano (en produccion BCrypt)
        role: body.role || 'AGENT'
      }
    });
    return newUser;
  }

  // --- WEBHOOKS & INBOUND LEAD CAPTURE ---
  
  @Post('webhooks/lead')
  async captureWebLead(@Body() body: CaptureWebLeadDto) {
    // Limpiar el teléfono para homogeneizar (quitar + y espacios) a 10 digitos MX
    const cleanPhone = body.phone.replace(/[^0-9]/g, '').slice(-10);
    const fullWaId = `521${cleanPhone}`; 

    // Obtener la compañía (Si no envían companyId, tomamos la de RadioTec/RentControl por defecto)
    let targetCompanyId = body.companyId;
    if (!targetCompanyId) {
      const company = await this.prisma.company.findFirst({
        where: { name: { contains: 'hurtado', mode: 'insensitive' } }
      });
      if(!company) throw new BadRequestException("No hay empresas principales registradas");
      targetCompanyId = company.id;
    }

    // 1. Crear Contacto o Recuperarlo si ya existe (Evitar duplicados)
    const contact = await this.prisma.contact.upsert({
      where: { phone_companyId: { phone: fullWaId, companyId: targetCompanyId } },
      create: {
        phone: fullWaId,
        name: body.name || "Prospecto Web",
        companyId: targetCompanyId,
        tags: ["Lead Web", body.interest.substring(0, 15)]
      },
      update: {
        name: body.name || "Prospecto Web"
      }
    });

    // 2. Determinar el Mensaje Automatizado según el Interés
    let botMessage = "";
    if (body.interest.includes("Soporte")) {
      const parts = body.interest.split(":");
      const issue = parts.length > 1 ? parts[1].trim() : "Asistencia General";
      botMessage = `🤖 ¡Hola ${body.name}! Hemos recibido tu reporte de *Soporte MAJIA OS*.\n\n📝 *Tu reporte:* "${issue}"\n\nNuestra Inteligencia Artificial o un Agente Humano te dará seguimiento por aquí a la brevedad.`;
    } else if (body.interest.includes("Internet") || body.interest.includes("WISP")) {
      botMessage = `🤖 ¡Hola ${body.name}! Soy el asistente virtual de *RadioTec Pro*.\n\nRecibí tu solicitud para nuestros *Planes de Internet de Ultra Velocidad*.\n\n¿Para qué colonia o sector te interesa el servicio? Te confirmaré cobertura al instante. 📡`;
    } else if (body.interest.includes("RentControl")) {
      botMessage = `🤖 ¡Hola ${body.name}! Soy la inteligencia de *RentControl SaaS*.\n\nRecibimos tu solicitud de afiliación a nuestro software inmobiliario.\n\nPara perfilar tu cuenta: ¿Cuántas propiedades/cuartos administras actualmente? 🏢`;
    } else if (body.interest.includes("Técnico")) {
      botMessage = `🤖 ¡Hola ${body.name}! Bienvenido a la Red de Proveedores de *RentControl*.\n\n¿Cuál es tu oficio principal (Plomería, Albañilería, Electricidad) y en qué ciudad te encuentras? 🛠️`;
    } else {
      botMessage = `🤖 ¡Hola ${body.name}! Recibimos tu contacto desde la página web. ¿En qué podemos ayudarte el día de hoy?`;
    }

    // 3. Registrar en silencio y esperar el INBOUND del prospecto
    try {
      // Ya NO disparamos mensaje outbound para evitar baneos de SPAM por WhatsApp.
      // El cliente debe mandar el primer mensaje manualmente. Solo lo dejamos perfilado.
      
      const savedMsg = await this.prisma.message.create({
         data: {
           body: `[SYSTEM] Prospecto registrado vía Web. Interés: ${body.interest}. *Esperando mensaje de inicio del cliente...*`,
           fromMe: true,
           contactId: contact.id
         }
      });
      
      // Emitir este trigger Inbound a los sockets para que refresque el Inbox visualmente
      this.whatsapp.emitToInbox(contact.id, savedMsg, contact.pipelineId);
      
      return { success: true, message: "Lead ingresado exitosamente a la Matrix OmniChat" };
    } catch (e) {
      console.error("Error disparando Webhook Lead WA Outbound:", e);
      return { success: false, message: "Lead registrado pero servidor WA no disponible" };
    }
  }

  @Post('contacts/assign-agent')
  async assignAgentToContact(@Body() body: { contactId: string, userId: string | null }) {
    if (!body.contactId) throw new BadRequestException("Falta contactId");
    const updated = await this.prisma.contact.update({
      where: { id: body.contactId },
      data: { assignedToId: body.userId }
    });
    return updated;
  }

  @Post('login')
  async login(@Body() body: { email: string, password: string }) {
    const user = await this.prisma.user.findUnique({ 
      where: { email: body.email },
      include: { company: { select: { facturaproTenantId: true } } }
    });
    if (!user || user.password !== body.password) {
      return { error: 'Credenciales inválidas' }; 
    }
    return {
      ...user,
      facturaproTenantId: user.company?.facturaproTenantId
    };
  }

  @Post('send')
  async sendDirectMessage(@Body() body: { contactId: string, text: string }) {
    try {
      const contact = await this.prisma.contact.findUnique({ where: { id: body.contactId } });
      if (!contact) return { error: 'Not found' };
      
      const savedMessage = await this.prisma.message.create({
          data: {
              body: body.text,
              fromMe: true,
              contactId: contact.id
          }
      });

      // Human Iterruption (Hand-Off) -> Apagamos el bot porque un humano acaba de intervenir
      if (contact.botStatus === 'ACTIVE') {
         await this.prisma.contact.update({ where: { id: contact.id }, data: { botStatus: 'PAUSED' } });
      }

      let targetPhone = contact.phone;
      if (!targetPhone.includes('@')) {
          targetPhone = `${targetPhone}@c.us`;
      }

      console.log(`[OmniChat] Intentando enviar mensaje a ${targetPhone}...`);
      await this.whatsapp.sendDirectMessage(contact.companyId, targetPhone, body.text);
      console.log(`[OmniChat] Mensaje enviado existosamente.`);
      
      return savedMessage;
    } catch (error: any) {
      console.error("[OmniChat] Error Crítico al enviar mensaje:", error);
      return { error: 'Internal Server Error', detail: error.toString() };
    }
  }

  @Post('bot/toggle')
  async toggleBotStatus(@Body() body: { contactId: string, status: string }) {
      if (!body.contactId || !['ACTIVE', 'PAUSED', 'RESOLVED'].includes(body.status)) {
         throw new BadRequestException("Payload inválido");
      }
      return this.prisma.contact.update({
         where: { id: body.contactId },
         data: { botStatus: body.status }
      });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadFile(@UploadedFile() file: any, @Body('contactId') contactId: string) {
    if (!file) throw new BadRequestException("Archivo no encontrado");
    if (!contactId) throw new BadRequestException("Falta contactId");

    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) return { error: 'Not found' };

    const mediaUrl = `http://localhost:3002/uploads/${file.filename}`;
    const mediaType = file.mimetype;

    const savedMessage = await this.prisma.message.create({
        data: {
            body: file.originalname || 'Archivo adjunto',
            fromMe: true,
            contactId: contact.id,
            mediaUrl,
            mediaType
        }
    });

    let targetPhone = contact.phone;
    if (!targetPhone.includes('@')) targetPhone = `${targetPhone}@c.us`;

    console.log(`[OmniChat] Intentando enviar Media a ${targetPhone}...`);
    try {
        await this.whatsapp.sendDirectMediaMessage(contact.companyId, targetPhone, file.path);
        console.log(`[OmniChat] Media enviado exitosamente.`);
    } catch(e) {
        console.error("Error enviando media:", e);
    }
    
    
    return savedMessage;
  }

  @Post('contacts/notes')
  async addContactNote(@Body() data: { contactId: string, text: string, authorId: string }) {
    return this.prisma.contactNote.create({
       data: {
         text: data.text,
         contactId: data.contactId,
         authorId: data.authorId
       }
    });
  }

  @Delete('contacts/notes/:id')
  async deleteContactNote(@Param('id') id: string) {
    return this.prisma.contactNote.delete({
       where: { id }
    });
  }

  @Put('contacts/notes/:id')
  async updateContactNote(@Param('id') id: string, @Body() data: { text: string }) {
    return this.prisma.contactNote.update({
       where: { id },
       data: { text: data.text }
    });
  }

  @Post('contacts/tags')
  async updateTags(@Body() body: { contactId: string, tags: string[] }) {
    if (!body.contactId || !body.tags) throw new BadRequestException("Faltan tags");
    
    const oldContact = await this.prisma.contact.findUnique({ where: { id: body.contactId } });
    
    const updated = await this.prisma.contact.update({
      where: { id: body.contactId },
      data: { tags: body.tags }
    });

    const oldTags = oldContact?.tags || [];
    if (body.tags.includes('LISTO_INSTALACION') && !oldTags.includes('LISTO_INSTALACION')) {
        const adminPhone = process.env.ADMIN_PHONE || '5216681020000'; // TODO: Configurar en .env
        const msg = `🚨 *NUEVA INSTALACIÓN LISTA*\n\nEl cliente *${updated.name}* (${updated.phone}) ha sido marcado como LISTO PARA INSTALACIÓN.\nPor favor revisa el CRM y agenda la cita en Google Calendar.`;
        
        this.whatsapp.sendDirectMessage(updated.companyId, `${adminPhone}@c.us`, msg).catch(e => console.error("Error sending admin alert", e));
        
        // Agregar a la Agenda Local
        this.prisma.calendarEvent.create({
           data: {
             title: `Instalación Pendiente: ${updated.name}`,
             description: `Requiere agendar instalación. Tel: ${updated.phone}`,
             startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default tomorrow
             endTime: new Date(Date.now() + 26 * 60 * 60 * 1000),
             contactId: updated.id,
             pipelineId: updated.pipelineId,
             companyId: updated.companyId,
             status: 'SCHEDULED'
           }
        }).catch(e => console.error(e));
    }

    return updated;
  }

  @Post('contacts/rename')
  async renameContact(@Body() body: { contactId: string, newName: string }) {
    if (!body.contactId || !body.newName) throw new BadRequestException();
    return this.prisma.contact.update({
       where: { id: body.contactId },
       data: { name: body.newName }
    });
  }

  @Post('contacts/edit-phone')
  async editContactPhone(@Body() body: { contactId: string, newPhone: string }) {
    if (!body.contactId || !body.newPhone) throw new BadRequestException("Faltan datos");
    const cleanPhone = body.newPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) throw new BadRequestException("El número de teléfono es muy corto");
    
    // Normalizar a formato WA
    let finalPhone = cleanPhone;
    if (!finalPhone.includes('@')) {
       // Siempre asumimos que lo modificó a un número celular normal.
       finalPhone = `521${cleanPhone.slice(-10)}`; 
       // Usamos 521 + 10 dígitos estandarizado
    }

    try {
        return await this.prisma.contact.update({
           where: { id: body.contactId },
           data: { phone: finalPhone }
        });
    } catch(e) {
        throw new BadRequestException("Ese número ya existe en tu directorio.");
    }
  }

  @Delete('contacts/:companyId/:id')
  async deleteContact(@Param('companyId') companyId: string, @Param('id') id: string) {
    if(!companyId || !id) throw new BadRequestException("ID Invalido");
    
    const contact = await this.prisma.contact.findFirst({ where: { id, companyId } });
    if(!contact) throw new BadRequestException("Contacto no encontrado");

    await this.prisma.$transaction([
      this.prisma.message.deleteMany({ where: { contactId: id } }),
      this.prisma.contactNote.deleteMany({ where: { contactId: id } }),
      this.prisma.calendarEvent.deleteMany({ where: { contactId: id } }),
      this.prisma.contact.delete({ where: { id } })
    ]);

    return { success: true, message: "Conversación eliminada atómicamente" };
  }

  @Get('contacts/all')
  async getAllContacts() {
    return this.prisma.contact.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { messages: true } }
      }
    });
  }

  @Post('contacts/import')
  async importContacts(@Body() body: ImportContactsDto) {
    let imported = 0;
    for (const c of body.contacts) {
      const cleanPhone = c.phone.replace(/\D/g, ''); // Remover espacios y guiones
      if (!cleanPhone || cleanPhone.length < 10) continue;

      try {
        await this.prisma.contact.upsert({
          where: {
            phone_companyId: {
              phone: cleanPhone,
              companyId: body.companyId
            }
          },
          update: { 
            name: c.name,
            ...(c.metadata && { metadata: c.metadata })
          },
          create: {
            phone: cleanPhone,
            name: c.name,
            companyId: body.companyId,
            ...(c.metadata && { metadata: c.metadata })
          }
        });
        imported++;
      } catch (e) {
        console.error(`Error importando lead ${c.name}:`, e);
      }
    }
    return { success: true, count: imported };
  }

  @Get('broadcast/campaigns/:companyId')
  async getCampaigns(@Param('companyId') companyId: string) {
    return this.prisma.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  @Post('broadcast')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `campaign-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  async triggerBroadcast(
    @Body() body: { companyId: string, message: string, audience: string, tag?: string, cronRule?: string, isScheduled?: string },
    @UploadedFile() file?: any
  ) {
    if (!body.companyId || !body.message || !body.audience) {
      throw new BadRequestException("Faltan campos para la campaña de difusión.");
    }
    
    let mediaUrl = null;
    let localFilePath = null;
    if (file) {
      mediaUrl = `http://localhost:3002/uploads/${file.filename}`;
      localFilePath = file.path;
    }

    const isRecurring = body.isScheduled === 'true';

    // 1. Guardar la Campaña en Prisma
    const campaign = await this.prisma.campaign.create({
      data: {
        companyId: body.companyId,
        message: body.message,
        audience: body.audience,
        tag: body.tag || null,
        mediaUrl: mediaUrl,
        status: isRecurring ? "RECURRING" : "IN_PROGRESS",
        isScheduled: isRecurring,
        cronRule: isRecurring && body.cronRule ? body.cronRule : null,
      }
    });
    
    // 2. Invocación asíncrona al motor SOLO si no es recurrente
    if (!isRecurring) {
        this.whatsapp.launchBroadcast(campaign.id, body.companyId, body.message, body.audience, body.tag, localFilePath);
        return { success: true, status: "Broadcast_Encolado", campaign };
    }
    
    return { success: true, status: "Broadcast_Recurrente_Programado", campaign };
  }

  // --- QUICK REPLIES (SLASH COMMANDS) ---

  @Get('quick-replies/:companyId')
  async getQuickReplies(@Param('companyId') companyId: string) {
    return this.prisma.quickReply.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' }
    });
  }

  @Post('quick-replies')
  async createQuickReply(@Body() body: { companyId: string, shortcut: string, content: string }) {
    if (!body.companyId || !body.shortcut || !body.content) throw new BadRequestException("Faltan datos");
    
    // Auto-fix shortcut to ensure it starts with a slash
    const cleanShortcut = body.shortcut.startsWith('/') ? body.shortcut.trim() : `/${body.shortcut.trim()}`;

    return this.prisma.quickReply.create({
      data: {
        companyId: body.companyId,
        shortcut: cleanShortcut,
        content: body.content
      }
    });
  }

  @Delete('quick-replies/:id')
  async deleteQuickReply(@Param('id') id: string) {
    return this.prisma.quickReply.delete({
      where: { id }
    });
  }

  @Post('sync-history')
  async syncHistory(@Body() body: { companyId: string }) {
    if (!body.companyId) {
       throw new BadRequestException("companyId requerido para la sincronización");
    }
    const result = await this.whatsapp.syncHistoricalMessages(body.companyId);
    return { success: true, ...result };
  }
  // --- ZERO-SWITCHING & AI COPILOT ---

  @Post('contacts/:id/summarize')
  async summarizeChat(@Param('id') contactId: string, @Query('companyId') companyId: string) {
    if (!companyId) {
       const company = await this.prisma.company.findFirst();
       if (!company) throw new BadRequestException("Company not found");
       companyId = company.id;
    }
    const summary = await this.ai.summarizeChat(companyId, contactId);
    
    if (summary) {
        // Guardarlo como nota interna
        await this.prisma.contactNote.create({
            data: {
               text: `🌟 [COPILOTO IA]\n${summary}`,
               contactId: contactId,
               authorId: 'SYSTEM_BOT'
            }
        });
    }
    return { success: true, summary };
  }

  @Post('wisphub/:phone/check')
  async checkWisphub(@Param('phone') phone: string, @Query('companyId') companyId: string) {
     if (!companyId) {
        const company = await this.prisma.company.findFirst();
        if (!company) throw new BadRequestException("Company not found");
        companyId = company.id;
     }
     const company = await this.prisma.company.findUnique({ where: { id: companyId }});
     if (!company || !company.wisphubApiKey) throw new BadRequestException("No hay API Key de WispHub");

     const apiKey = this.crypto.decrypt(company.wisphubApiKey);
     const searchPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
     
     const wispRes = await axios.get(`https://api.wisphub.net/api/clientes/?telefono=${searchPhone}`, {
         headers: { 'Authorization': `Api-Key ${apiKey}` }
     });

     if (wispRes.data && wispRes.data.results && wispRes.data.results.length > 0) {
         const cliente = wispRes.data.results[0];
         return {
             success: true,
             nombre: cliente.nombre,
             estado: cliente.estado,
             usuario: cliente.usuario,
             router: cliente.router || null
         };
     } else {
         return { success: false, message: "No encontrado" };
     }
  }

  @Post('rentcontrol/ticket')
  async createTicket(@Body() body: { contactId: string, title: string, description: string }) {
      // Simulación de conexión a RentControl
      const contact = await this.prisma.contact.findUnique({ where: { id: body.contactId } });
      await this.prisma.contactNote.create({
          data: {
              text: `🔧 [TICKET RENTCONTROL CREADO]\nAsunto: ${body.title}\nProblema: ${body.description}`,
              contactId: body.contactId,
              authorId: 'AGENTE (Zero-Switching)'
          }
      });
      return { success: true };
  }
}
