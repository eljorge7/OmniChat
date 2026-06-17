import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellersService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, data: any) {
    const { raffles, ...sellerData } = data;
    return this.prisma.seller.create({
      data: {
        ...sellerData,
        companyId,
        raffles: raffles && raffles.length > 0 ? {
          connect: raffles.map((id: string) => ({ id }))
        } : undefined
      },
      include: {
        raffles: true
      }
    });
  }

  async findAll(companyId: string) {
    return this.prisma.seller.findMany({
      where: { companyId },
      include: {
        raffles: {
            select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: string, data: any) {
    const { raffles, ...sellerData } = data;
    
    return this.prisma.seller.update({
      where: { id },
      data: {
        ...sellerData,
        raffles: raffles ? {
          set: raffles.map((rId: string) => ({ id: rId }))
        } : undefined
      },
      include: {
        raffles: true
      }
    });
  }

  async remove(id: string) {
    return this.prisma.seller.delete({
      where: { id }
    });
  }
}
