import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';

@Injectable()
export class BroadcastCronService {
  private readonly logger = new Logger(BroadcastCronService.name);

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsappService
  ) {}

  // Se ejecuta todos los días a las 9:00 AM (Ajusta según necesidad)
  @Cron('0 9 * * *')
  async handleRecurringCampaigns() {
    this.logger.log('Despertando Motor CRON: Revisando campañas recurrentes de hoy...');
    
    // Obtener día actual
    const today = new Date();
    const currentDay = today.getDate(); // 1 - 31
    
    // Buscar campañas activas que sean recurrentes
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'RECURRING',
        isScheduled: true,
        cronRule: { not: null }
      }
    });

    for (const campaign of campaigns) {
      // Parsear la regla cron simplificada (ej. "15,30" -> los días 15 y 30)
      const executionDays = campaign.cronRule?.split(',').map(d => parseInt(d.trim(), 10)) || [];
      
      if (executionDays.includes(currentDay)) {
         this.logger.log(`[CRON] Disparando campaña recurrente: ${campaign.id} (${campaign.name})`);
         
         // Verificar filtro metadataFilter si existe
         let filterTag = campaign.tag;
         // TODO: Aquí se podría expandir la lógica para usar metadataFilter en vez de solo tag

         this.whatsappService.launchBroadcast(
             campaign.id, 
             campaign.companyId, 
             campaign.message, 
             campaign.audience, 
             filterTag || undefined, 
             campaign.mediaUrl || undefined
         );

         // Actualizar lastRunAt
         await this.prisma.campaign.update({
             where: { id: campaign.id },
             data: { lastRunAt: new Date() }
         });
      }
    }
  }
}
