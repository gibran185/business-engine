import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MerchantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns true if the user is listed as staff for the merchant (core.merchant_staff).
   */
  async isUserStaffOfMerchant(
    userId: string,
    merchantId: string,
  ): Promise<boolean> {
    const row = await this.prisma.merchant_staff.findFirst({
      where: {
        user_id: userId,
        merchant_id: merchantId,
      },
      select: { id: true },
    });
    return row !== null;
  }
}
