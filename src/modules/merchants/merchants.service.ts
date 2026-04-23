import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  async getConfigBySlug(slug: string) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        branding_config: true,
        phone_number: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with slug ${slug} not found`);
    }

    return merchant;
  }
}
