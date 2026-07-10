import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/ai/analytics')
export class AiAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAiAnalytics(@Query('companyId') companyId: string) {
    if (!companyId) throw new HttpException('companyId is required', HttpStatus.BAD_REQUEST);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        aiTokensUsed: true,
        aiTasksAutomated: true,
        aiMoneySaved: true,
      }
    });

    // Costo base de un token de GPT-4o-mini (aproximado): $0.00015 / 1k tokens
    const tokensCostUsd = (company?.aiTokensUsed || 0) * (0.00015 / 1000);
    const moneySavedUsd = company?.aiMoneySaved || 0;
    
    // Net ROI (Dinero ahorrado - Costo de tokens)
    const netRoi = moneySavedUsd - tokensCostUsd;

    return {
      success: true,
      data: {
        tokensUsed: company?.aiTokensUsed || 0,
        tokensCostUsd: tokensCostUsd,
        tasksAutomated: company?.aiTasksAutomated || 0,
        moneySavedUsd: moneySavedUsd,
        netRoiUsd: netRoi
      }
    };
  }
}
