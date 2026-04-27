import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MerchantStaffRole } from './merchant-staff-role.enum.js';

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

  async getUserStaffRole(
    userId: string,
    merchantId: string,
  ): Promise<MerchantStaffRole | null> {
    const row = await this.prisma.merchant_staff.findFirst({
      where: {
        user_id: userId,
        merchant_id: merchantId,
      },
      select: { role: true },
    });

    if (!row?.role) return null;

    switch (row.role) {
      case MerchantStaffRole.ADMIN:
      case MerchantStaffRole.EMPLOYEE:
      case MerchantStaffRole.SUPERVISOR:
        return row.role;
      default:
        return null;
    }
  }
}
