import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantStaffRole } from '../../tenancy/merchant-staff-role.enum.js';
import type { CreateMerchantStaffDto } from './dto/create-merchant-staff.dto.js';
import type { SetStaffServicesDto } from './dto/set-staff-services.dto.js';
import type { SetStaffWorkingHoursDto } from './dto/set-staff-working-hours.dto.js';
import type { UpdateMerchantStaffDto } from './dto/update-merchant-staff.dto.js';

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

  async createMerchantStaff(merchantId: string, dto: CreateMerchantStaffDto) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    try {
      return await this.prisma.merchant_staff.create({
        data: {
          merchant_id: merchantId,
          user_id: dto.userId,
          role: dto.role,
        },
        select: {
          id: true,
          merchant_id: true,
          user_id: true,
          role: true,
          created_at: true,
        },
      });
    } catch (err: any) {
      // P2002 unique constraint violation (merchant_id, user_id)
      if (err?.code === 'P2002') {
        throw new ConflictException('User is already staff of this merchant');
      }
      throw err;
    }
  }

  async listMerchantStaff(merchantId: string) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return this.prisma.merchant_staff.findMany({
      where: { merchant_id: merchantId },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        merchant_id: true,
        user_id: true,
        role: true,
        created_at: true,
      },
    });
  }

  async listMerchantCustomers(merchantId: string, requesterUserId: string) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const requesterStaff = await this.prisma.merchant_staff.findFirst({
      where: { merchant_id: merchantId, user_id: requesterUserId },
      select: { role: true },
    });
    if (!requesterStaff) {
      throw new NotFoundException('Staff not found for this merchant');
    }

    const canViewSensitive =
      requesterStaff.role === MerchantStaffRole.ADMIN ||
      requesterStaff.role === MerchantStaffRole.SUPERVISOR;

    const rows = await this.prisma.merchant_customers.findMany({
      where: { merchant_id: merchantId },
      orderBy: [{ last_seen_at: 'desc' }, { first_seen_at: 'desc' }],
      select: {
        customer_id: true,
        first_seen_at: true,
        last_seen_at: true,
        status: true,
        customer_profiles: {
          select: {
            full_name: true,
            email: true,
            phone_number: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      customerId: row.customer_id,
      fullName: row.customer_profiles?.full_name ?? null,
      email: canViewSensitive ? (row.customer_profiles?.email ?? null) : null,
      phoneNumber: canViewSensitive
        ? (row.customer_profiles?.phone_number ?? null)
        : null,
      firstSeenAt: row.first_seen_at ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      status: row.status,
    }));
  }

  async updateMerchantCustomerStatus(
    merchantId: string,
    customerId: string,
    status: 'active' | 'blocked',
  ) {
    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const relation = await this.prisma.merchant_customers.findUnique({
      where: {
        merchant_id_customer_id: {
          merchant_id: merchantId,
          customer_id: customerId,
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
          customer_id: customerId,
        },
      },
      data: {
        status,
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

  async getMerchantStaffDetail(merchantId: string, staffId: string) {
    const staff = await this.prisma.merchant_staff.findFirst({
      where: { id: staffId, merchant_id: merchantId },
      select: {
        id: true,
        merchant_id: true,
        user_id: true,
        role: true,
        created_at: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found for this merchant');
    }

    const [services, workingHours] = await Promise.all([
      this.prisma.staff_services.findMany({
        where: { merchant_id: merchantId, merchant_staff_id: staffId },
        select: { service_id: true },
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.staff_working_hours.findMany({
        where: { merchant_id: merchantId, merchant_staff_id: staffId },
        select: {
          id: true,
          day_of_week: true,
          start_minute: true,
          end_minute: true,
          is_active: true,
        },
        orderBy: [{ day_of_week: 'asc' }, { start_minute: 'asc' }],
      }),
    ]);

    return {
      ...staff,
      serviceIds: services
        .map((s) => s.service_id)
        .filter((id): id is string => typeof id === 'string'),
      workingHours: workingHours.map((r) => ({
        id: r.id,
        dayOfWeek: r.day_of_week,
        startMinute: r.start_minute,
        endMinute: r.end_minute,
        isActive: r.is_active ?? true,
      })),
    };
  }

  async updateMerchantStaff(
    merchantId: string,
    staffId: string,
    dto: UpdateMerchantStaffDto,
  ) {
    const existing = await this.prisma.merchant_staff.findFirst({
      where: { id: staffId, merchant_id: merchantId },
      select: { id: true, role: true },
    });
    if (!existing) {
      throw new NotFoundException('Staff not found for this merchant');
    }

    if (
      existing.role === MerchantStaffRole.ADMIN &&
      dto.role !== MerchantStaffRole.ADMIN
    ) {
      const adminCount = await this.prisma.merchant_staff.count({
        where: {
          merchant_id: merchantId,
          role: MerchantStaffRole.ADMIN,
        },
      });
      if (adminCount <= 1) {
        throw new ConflictException(
          'Cannot change the role of the last admin for this merchant',
        );
      }
    }

    return this.prisma.merchant_staff.update({
      where: { id: staffId },
      data: { role: dto.role },
      select: {
        id: true,
        merchant_id: true,
        user_id: true,
        role: true,
        created_at: true,
      },
    });
  }

  async removeMerchantStaff(merchantId: string, staffId: string) {
    const existing = await this.prisma.merchant_staff.findFirst({
      where: { id: staffId, merchant_id: merchantId },
      select: { id: true, role: true },
    });
    if (!existing) {
      throw new NotFoundException('Staff not found for this merchant');
    }

    if (existing.role === MerchantStaffRole.ADMIN) {
      const adminCount = await this.prisma.merchant_staff.count({
        where: {
          merchant_id: merchantId,
          role: MerchantStaffRole.ADMIN,
        },
      });
      if (adminCount <= 1) {
        throw new ConflictException(
          'Cannot remove the last admin for this merchant',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staff_services.deleteMany({
        where: { merchant_id: merchantId, merchant_staff_id: staffId },
      });
      await tx.staff_working_hours.deleteMany({
        where: { merchant_id: merchantId, merchant_staff_id: staffId },
      });
      await tx.merchant_staff.delete({ where: { id: staffId } });
    });
  }

  async setStaffServices(
    merchantId: string,
    staffId: string,
    dto: SetStaffServicesDto,
  ) {
    const staff = await this.prisma.merchant_staff.findFirst({
      where: { id: staffId, merchant_id: merchantId },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found for this merchant');
    }

    const services = await this.prisma.services.findMany({
      where: { merchant_id: merchantId, id: { in: dto.serviceIds } },
      select: { id: true },
    });
    if (services.length !== dto.serviceIds.length) {
      throw new NotFoundException('One or more services not found for merchant');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staff_services.deleteMany({
        where: { merchant_id: merchantId, merchant_staff_id: staffId },
      });
      await tx.staff_services.createMany({
        data: dto.serviceIds.map((serviceId) => ({
          merchant_id: merchantId,
          merchant_staff_id: staffId,
          service_id: serviceId,
        })),
      });
    });

    return { staffId, serviceIds: dto.serviceIds };
  }

  async setStaffWorkingHours(
    merchantId: string,
    staffId: string,
    dto: SetStaffWorkingHoursDto,
  ) {
    const staff = await this.prisma.merchant_staff.findFirst({
      where: { id: staffId, merchant_id: merchantId },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found for this merchant');
    }

    for (const row of dto.rows) {
      if (!(row.startMinute < row.endMinute)) {
        throw new ConflictException('working hours require startMinute < endMinute');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staff_working_hours.deleteMany({
        where: { merchant_id: merchantId, merchant_staff_id: staffId },
      });
      await tx.staff_working_hours.createMany({
        data: dto.rows.map((r) => ({
          merchant_id: merchantId,
          merchant_staff_id: staffId,
          day_of_week: r.dayOfWeek,
          start_minute: r.startMinute,
          end_minute: r.endMinute,
          is_active: r.isActive,
        })),
      });
    });

    return { staffId, rows: dto.rows };
  }
}
