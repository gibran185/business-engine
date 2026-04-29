import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { MerchantCustomerStatus } from './customer-merchant-status.constants.js';

type CustomerRelationsDbClient = Pick<
  PrismaService,
  'customer_profiles' | 'merchant_customers' | 'merchants'
>;

type EnsureCustomerMerchantRelationParams = {
  merchantId: string;
  customerId: string;
  customerEmail?: string;
  fullName?: string;
  phoneNumber?: string;
  observedAt?: Date;
  rejectIfBlocked?: boolean;
};

@Injectable()
export class CustomerRelationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureMerchantExists(
    merchantId: string,
    db: CustomerRelationsDbClient = this.prisma,
  ): Promise<void> {
    const merchant = await db.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
  }

  async upsertCustomerProfile(
    customerId: string,
    profile: {
      email?: string;
      fullName?: string;
      phoneNumber?: string;
    },
    db: CustomerRelationsDbClient = this.prisma,
  ) {
    const data = {
      ...(profile.email !== undefined ? { email: profile.email } : {}),
      ...(profile.fullName !== undefined ? { full_name: profile.fullName } : {}),
      ...(profile.phoneNumber !== undefined
        ? { phone_number: profile.phoneNumber }
        : {}),
    };

    return db.customer_profiles.upsert({
      where: { id: customerId },
      create: {
        id: customerId,
        email: profile.email ?? null,
        full_name: profile.fullName ?? null,
        phone_number: profile.phoneNumber ?? null,
      },
      update: data,
      select: {
        id: true,
        email: true,
        full_name: true,
        phone_number: true,
      },
    });
  }

  async ensureCustomerMerchantRelation(
    params: EnsureCustomerMerchantRelationParams,
    db: CustomerRelationsDbClient = this.prisma,
  ) {
    const observedAt = params.observedAt ?? new Date();

    await this.ensureMerchantExists(params.merchantId, db);
    await this.upsertCustomerProfile(
      params.customerId,
      {
        email: params.customerEmail,
        fullName: params.fullName,
        phoneNumber: params.phoneNumber,
      },
      db,
    );

    const existing = await db.merchant_customers.findUnique({
      where: {
        merchant_id_customer_id: {
          merchant_id: params.merchantId,
          customer_id: params.customerId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (existing?.status === 'blocked' && params.rejectIfBlocked !== false) {
      throw new ForbiddenException('Customer is blocked for this merchant');
    }

    const nextStatus: MerchantCustomerStatus =
      existing && existing.status !== 'blocked' ? 'active' : 'active';

    return db.merchant_customers.upsert({
      where: {
        merchant_id_customer_id: {
          merchant_id: params.merchantId,
          customer_id: params.customerId,
        },
      },
      create: {
        merchant_id: params.merchantId,
        customer_id: params.customerId,
        first_seen_at: observedAt,
        last_seen_at: observedAt,
        status: 'active',
      },
      update: {
        status: nextStatus,
        last_seen_at: observedAt,
        updated_at: new Date(),
      },
      select: {
        id: true,
        merchant_id: true,
        customer_id: true,
        first_seen_at: true,
        last_seen_at: true,
        status: true,
      },
    });
  }
}
