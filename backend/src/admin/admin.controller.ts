import { Controller, Post, Body, Headers, UnauthorizedException, Get, Param, Delete, Put, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

@Controller('api/v1/admin')
export class AdminController {
  private readonly MASTER_KEY = 'zohomasterkey_99_omnichat_x'; // Proteger en .env idealmente
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService
  ) {}

  @Get('companies')
  async getCompanies(@Headers('authorization') auth: string) {
    if (!auth || auth !== `Bearer ${this.MASTER_KEY}`) throw new UnauthorizedException('Master Key Inválida');
    
    const companies = await this.prisma.company.findMany({
      include: {
        _count: { select: { contacts: true, users: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return companies;
  }

  @Post('companies')
  async createCompany(
    @Headers('authorization') auth: string,
    @Body() body: { name: string, email: string, password?: string, phone?: string }
  ) {
    if (!auth || auth !== `Bearer ${this.MASTER_KEY}`) throw new UnauthorizedException('Master Key Inválida');

    const apiKey = `sk_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // 1. Creamos la Compañía (Tenant)
    const company = await this.prisma.company.create({
      data: {
        name: body.name,
        apiKey: apiKey
      }
    });

    // 2. Le creamos su Administrador Supremo local
    const password = body.password || 'OmniChat2026';
    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        password: password, // Asumiendo que el Frontend compara en plano o Prisma lo hashea (actualmente en OmniChat se compara plano en el MVP local login)
        role: 'ADMIN',
        name: `Admin de ${body.name}`,
        companyId: company.id
      }
    });

    // 3. Crear el Pipeline predeterminado "General"
    await this.prisma.pipeline.create({
      data: {
        name: 'Atención General',
        companyId: company.id
      }
    });

    // 4. Enviar notificación por WhatsApp si tenemos número
    if (body.phone) {
      const cleanPhone = body.phone.replace(/[^0-9]/g, '').slice(-10);
      const fullWaId = `521${cleanPhone}@c.us`; 
      const welcomeMsg = `🎉 *¡Felicidades y Bienvenido a OmniChat SaaS!*\n\nHola ${body.name},\nSe ha generado con éxito tu Super Agencia Maestra.\n\nTus credenciales de administrador son:\n✉️ *Correo:* ${body.email}\n🔑 *Contraseña:* ${password}\n\nConéctate vía web para ligar tu QR y comenzar a gestionar a tu equipo y prospectos. ✅`;
      
      try {
        // Enlazar el contacto bajo la misma agencia madre o agencia cero, si queremos.
        // Pero el whatsapp.service manda el mensaje desde el WhatsApp maestro de "RentControl" / "OmniChat Admin"
        // Se asume que existe la master company o mandamos por el gateway por defecto.
        const masterCompany = await this.prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
        if(masterCompany && masterCompany.id !== company.id) {
           await this.whatsapp.sendDirectMessage(masterCompany.id, fullWaId, welcomeMsg);
           this.logger.log(`Mensaje de bienvenida enviado a ${fullWaId} vía WhatsApp`);
        }
      } catch(e: any) {
        this.logger.warn(`No se pudo enviar WP de bienvenida a ${body.phone}: ${e.message}`);
      }
    }

    // 5. Enviar notificación por Email (Gmail)
    try {
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
             user: process.env.SMTP_USER || 'rtfacturacionauto@gmail.com',
             pass: process.env.SMTP_PASS || 'aqui_tu_app_password' // Idealmente poner real app password
          }
      });
      await transporter.sendMail({
          from: '"OmniChat Admin" <adminglobal@omnichat.com>',
          to: body.email,
          subject: '¡Bienvenido a OmniChat! - Credenciales de Acceso',
          html: `<h1>Bienvenido a OmniChat</h1><p>Hola, tu agencia <b>${body.name}</b> ha sido creada.</p><p>Usuario: <b>${body.email}</b><br/>Contraseña: <b>${password}</b></p><p>Ya puedes acceder al dashboard.</p>`
      });
      this.logger.log(`Email de bienvenida enviado a ${body.email}`);
    } catch(e) {
        this.logger.error(`Error enviando email a ${body.email}`, e);
    }

    return {
      success: true,
      company: company,
      adminEmail: user.email,
      temporaryPassword: password
    };
  }

  @Put('companies/:id')
  async updateCompany(
      @Headers('authorization') auth: string,
      @Param('id') id: string,
      @Body() body: { name: string }
  ) {
      if (!auth || auth !== `Bearer ${this.MASTER_KEY}`) throw new UnauthorizedException('Master Key Inválida');
      return this.prisma.company.update({
          where: { id },
          data: { name: body.name }
      });
  }

  @Delete('companies/:id')
  async deleteCompany(
      @Headers('authorization') auth: string,
      @Param('id') id: string
  ) {
      if (!auth || auth !== `Bearer ${this.MASTER_KEY}`) throw new UnauthorizedException('Master Key Inválida');
      
      // Prisma está en cascade? Si no, tendríamos que borrar users, contacts, pipelines, replies.
      // Depende del schema. Revisaremos el schema.
      // Por limpieza total:
      await this.prisma.user.deleteMany({ where: { companyId: id } });
      await this.prisma.pipeline.deleteMany({ where: { companyId: id } });
      await this.prisma.quickReply.deleteMany({ where: { companyId: id } });
      
      // Borrar notas y luego contacts
      const contacts = await this.prisma.contact.findMany({ where: { companyId: id }, select: { id: true } });
      const contactIds = contacts.map(c => c.id);
      await this.prisma.contactNote.deleteMany({ where: { contactId: { in: contactIds } } });
      await this.prisma.message.deleteMany({ where: { contactId: { in: contactIds } } });
      await this.prisma.contact.deleteMany({ where: { companyId: id } });

      const deleted = await this.prisma.company.delete({
          where: { id }
      });
      return { success: true, deleted };
  }
}
