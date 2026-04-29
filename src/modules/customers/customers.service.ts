import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CustomerRelationsService } from './customer-relations.service.js';
import type { AssociateMerchantDto } from './dto/associate-merchant.dto.js';
import type { CustomerOnboardingDto } from './dto/customer-onboarding.dto.js';
import type { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerRelations: CustomerRelationsService,
  ) {}

  async onboarding(userId: string, jwtEmail: string | undefined, dto: CustomerOnboardingDto) {
    const profile = await this.customerRelations.upsertCustomerProfile(userId, {
      email: dto.email ?? jwtEmail,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
    });

    const relation = await this.customerRelations.ensureCustomerMerchantRelation({
      merchantId: dto.merchantId,
      customerId: userId,
      customerEmail: dto.email ?? jwtEmail,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
    });

    return { profile, relation };
  }

  async updateProfile(userId: string, jwtEmail: string | undefined, dto: UpdateCustomerProfileDto) {
    return this.customerRelations.upsertCustomerProfile(userId, {
      email: dto.email ?? jwtEmail,
      fullName: dto.fullName,
      phoneNumber: dto.phoneNumber,
    });
  }

  async associateMerchant(userId: string, jwtEmail: string | undefined, dto: AssociateMerchantDto) {
    return this.customerRelations.ensureCustomerMerchantRelation({
      merchantId: dto.merchantId,
      customerId: userId,
      customerEmail: jwtEmail,
    });
  }

  async listCustomerMerchants(userId: string) {
    return this.prisma.merchant_customers.findMany({
      where: { customer_id: userId },
      orderBy: [{ last_seen_at: 'desc' }, { first_seen_at: 'desc' }],
      select: {
        merchant_id: true,
        status: true,
        first_seen_at: true,
        last_seen_at: true,
        merchants: {
          select: {
            id: true,
            name: true,
            slug: true,
            branding_config: true,
            phone_number: true,
            address: true,
          },
        },
      },
    });
  }

  async unsubscribeMerchant(userId: string, merchantId: string) {
    const relation = await this.prisma.merchant_customers.findUnique({
      where: {
        merchant_id_customer_id: {
          merchant_id: merchantId,
          customer_id: userId,
        },
      },
      select: { id: true },
    });

    if (!relation) {
      throw new NotFoundException('Customer relationship not found for this merchant');
    }

    return this.prisma.merchant_customers.update({
      where: {
        merchant_id_customer_id: {
          merchant_id: merchantId,
          customer_id: userId,
        },
      },
      data: {
        status: 'unsubscribed',
        updated_at: new Date(),
      },
      select: {
        id: true,
        merchant_id: true,
        customer_id: true,
        status: true,
        first_seen_at: true,
        last_seen_at: true,
      },
    });
  }
}
