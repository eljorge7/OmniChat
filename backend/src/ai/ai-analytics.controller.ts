import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../users/jwt-auth.guard';

@Controller('ai/analytics')
@UseGuards(JwtAuthGuard)
export class AiAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAiAnalytics(@Req() req: any) {
    const user = req.user;
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
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
