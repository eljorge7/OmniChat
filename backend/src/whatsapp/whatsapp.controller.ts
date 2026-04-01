import { Controller, Get, Post, Body, UseInterceptors, UploadedFile, BadRequestException, Param, Delete, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { ImportContactsDto } from './dto/import-contacts.dto';
import { CaptureWebLeadDto } from './dto/capture-web-lead.dto';

@Controller('api/inbox')
export class WhatsappController {
  constructor(private prisma: PrismaService, private whatsapp: WhatsappService) {}

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
      time: c.messages[0]?.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '',
      unread: 0,
      pipeId: c.pipelineId,
      botStatus: c.botStatus,
      tags: c.tags || [],
      notes: c.notes || [],
      assignedTo: c.assignedTo || null,
      messages: c.messages.reverse()
    }));

    return {
      pipelines, // Return the full pipeline objects so the Bot Settings page can edit 'keywords' and 'autoReply'
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
       openAiKey: company.openAiKey || "",
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
         openAiKey: body.openAiKey?.trim() || null,
         openAiPrompt: body.openAiPrompt || null
       }
    });

    return { success: true, message: "Cerebro IA actualizado" };
  }

  @Post('assign')
  async assignContact(@Body() body: { contactId: string, pipelineId: string }) {
    const updated = await this.prisma.contact.update({
      where: { id: body.contactId },
      data: { pipelineId: body.pipelineId }
    });
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
    const fullWaId = `521${cleanPhone}@c.us`; 

    // Obtener la compañía (Si no envían companyId, tomamos la de RadioTec/RentControl por defecto)
    let targetCompanyId = body.companyId;
    if (!targetCompanyId) {
      const company = await this.prisma.company.findFirst();
      if(!company) throw new BadRequestException("No hay empresas registradas en OmniChat");
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
    if (body.interest.includes("Internet") || body.interest.includes("WISP")) {
      botMessage = `🤖 ¡Hola ${body.name}! Soy el asistente virtual de *RadioTec Pro*.\n\nRecibí tu solicitud para nuestros *Planes de Internet de Ultra Velocidad*.\n\n¿Para qué colonia o sector te interesa el servicio? Te confirmaré cobertura al instante. 📡`;
    } else if (body.interest.includes("RentControl")) {
      botMessage = `🤖 ¡Hola ${body.name}! Soy la inteligencia de *RentControl SaaS*.\n\nRecibimos tu solicitud de afiliación a nuestro software inmobiliario.\n\nPara perfilar tu cuenta: ¿Cuántas propiedades/cuartos administras actualmente? 🏢`;
    } else if (body.interest.includes("Técnico")) {
      botMessage = `🤖 ¡Hola ${body.name}! Bienvenido a la Red de Proveedores de *RentControl*.\n\n¿Cuál es tu oficio principal (Plomería, Albañilería, Electricidad) y en qué ciudad te encuentras? 🛠️`;
    } else {
      botMessage = `🤖 ¡Hola ${body.name}! Recibimos tu contacto desde la página web de *RadioTec Pro*. ¿En qué podemos ayudarte el día de hoy?`;
    }

    // 3. Disparar mensaje outbound silenciosamente y guardarlo en Base de Datos
    try {
      await this.whatsapp.sendDirectMessage(targetCompanyId, fullWaId, botMessage);
      
      const savedMsg = await this.prisma.message.create({
         data: {
           body: botMessage,
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
    const user = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.password !== body.password) {
      return { error: 'Credenciales inválidas' }; 
    }
    return user;
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
  async addInternalNote(@Body() body: { contactId: string, text: string, authorId: string }) {
    if (!body.contactId || !body.text) throw new BadRequestException("Faltan datos de la nota");
    const note = await this.prisma.contactNote.create({
      data: {
        text: body.text,
        contactId: body.contactId,
        authorId: body.authorId || 'Agente'
      }
    });
    return note;
  }

  @Post('contacts/tags')
  async updateTags(@Body() body: { contactId: string, tags: string[] }) {
    if (!body.contactId || !body.tags) throw new BadRequestException("Faltan tags");
    const updated = await this.prisma.contact.update({
      where: { id: body.contactId },
      data: { tags: body.tags }
    });
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
          update: { name: c.name },
          create: {
            phone: cleanPhone,
            name: c.name,
            companyId: body.companyId
          }
        });
        imported++;
      } catch (e) {
        console.error(`Error importando lead ${c.name}:`, e);
      }
    }
    return { success: true, count: imported };
  }

  @Post('broadcast')
  async triggerBroadcast(@Body() body: { companyId: string, message: string, audience: string, tag?: string }) {
    if (!body.companyId || !body.message || !body.audience) {
      throw new BadRequestException("Faltan campos para la campaña de difusión.");
    }
    
    // Invocación asíncrona "Fire-and-Forget" al microservicio interno de Throttling
    this.whatsapp.launchBroadcast(body.companyId, body.message, body.audience, body.tag);
    
    return { success: true, status: "Broadcast_Encolado" };
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
}
