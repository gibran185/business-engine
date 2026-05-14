import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantStaffRole } from '../../tenancy/merchant-staff-role.enum.js';
import type { JwtUser } from '../../auth/types/jwt-user.types.js';
import type { CreateMerchantStaffDto } from './dto/create-merchant-staff.dto.js';
import type {
  CreateMerchantOnboardingDto,
  HeadquartersOnboardingDto,
} from './dto/create-merchant-onboarding.dto.js';
import type { SetStaffServicesDto } from './dto/set-staff-services.dto.js';
import type { SetStaffWorkingHoursDto } from './dto/set-staff-working-hours.dto.js';
import type { UpdateMerchantStaffDto } from './dto/update-merchant-staff.dto.js';
import type { UpdateHeadquartersOnboardingDto } from './dto/update-merchant-onboarding.dto.js';
import type { UpdateMerchantOnboardingDto } from './dto/update-merchant-onboarding.dto.js';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  async onboarding(user: JwtUser, dto: CreateMerchantOnboardingDto) {
    const ownerUserId = user.userId;
    const baseSlug = MerchantsService.slugifyBusinessName(dto.businessName);
    const addressSummary = dto.headquarters
      ? MerchantsService.buildHeadquartersSummaryFromDto(dto.headquarters)
      : null;
    const phone = dto.businessPhone?.trim() ? dto.businessPhone.trim() : null;
    const taxId = dto.taxId?.trim() ? dto.taxId.trim() : null;
    const lrFirst = dto.legalRepresentative?.firstName?.trim() ?? null;
    const lrLast = dto.legalRepresentative?.lastName?.trim() ?? null;
    const hq = dto.headquarters;
    const latStr = dto.geoposition ? dto.geoposition.lat.toFixed(8) : null;
    const lngStr = dto.geoposition ? dto.geoposition.long.toFixed(8) : null;

    return this.prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      let suffix = 0;
      while (
        await tx.merchants.findUnique({
          where: { slug },
          select: { id: true },
        })
      ) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const merchant = await tx.merchants.create({
        data: {
          name: dto.businessName.trim(),
          slug,
          owner_user_id: ownerUserId,
          legal_representative_first_name: lrFirst,
          legal_representative_last_name: lrLast,
          tax_id: taxId,
          headquarters_first_line: hq?.firstLine.trim() ?? null,
          headquarters_second_line: hq?.secondLine?.trim() || null,
          headquarters_zipcode: hq?.zipcode.trim() ?? null,
          headquarters_municipality: hq?.municipality.trim() ?? null,
          headquarters_state: hq?.state.trim() ?? null,
          headquarters_country: hq?.country.trim() ?? null,
          headquarters_latitude: latStr,
          headquarters_longitude: lngStr,
          phone_number: phone,
          address: addressSummary,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          owner_user_id: true,
          legal_representative_first_name: true,
          legal_representative_last_name: true,
          tax_id: true,
          headquarters_first_line: true,
          headquarters_second_line: true,
          headquarters_zipcode: true,
          headquarters_municipality: true,
          headquarters_state: true,
          headquarters_country: true,
          headquarters_latitude: true,
          headquarters_longitude: true,
          phone_number: true,
          address: true,
          timezone: true,
          created_at: true,
          updated_at: true,
        },
      });

      try {
        const staff = await tx.merchant_staff.create({
          data: {
            merchant_id: merchant.id,
            user_id: ownerUserId,
            role: MerchantStaffRole.ADMIN,
          },
          select: {
            id: true,
            merchant_id: true,
            user_id: true,
            role: true,
            created_at: true,
          },
        });

        return {
          merchant: MerchantsService.serializeMerchantRow(merchant),
          staff,
        };
      } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
        if (code === 'P2002') {
          throw new ConflictException('Could not complete onboarding (duplicate membership)');
        }
        throw err;
      }
    });
  }

  async updateMerchantOnboarding(merchantId: string, dto: UpdateMerchantOnboardingDto) {
    const existing = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: {
        id: true,
        name: true,
        slug: true,
        owner_user_id: true,
        legal_representative_first_name: true,
        legal_representative_last_name: true,
        tax_id: true,
        headquarters_first_line: true,
        headquarters_second_line: true,
        headquarters_zipcode: true,
        headquarters_municipality: true,
        headquarters_state: true,
        headquarters_country: true,
        headquarters_latitude: true,
        headquarters_longitude: true,
        phone_number: true,
        address: true,
        timezone: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Merchant not found');
    }

    const data: Prisma.merchantsUpdateInput = {
      updated_at: new Date(),
    };

    if (dto.businessName !== undefined) {
      data.name = dto.businessName.trim();
    }
    if (dto.taxId !== undefined) {
      data.tax_id = dto.taxId.trim() ? dto.taxId.trim() : null;
    }
    if (dto.businessPhone !== undefined) {
      data.phone_number = dto.businessPhone.trim();
    }
    if (dto.legalRepresentative) {
      const lr = dto.legalRepresentative;
      if (lr.firstName !== undefined) {
        data.legal_representative_first_name = lr.firstName.trim();
      }
      if (lr.lastName !== undefined) {
        data.legal_representative_last_name = lr.lastName.trim();
      }
    }
    if (dto.geoposition) {
      data.headquarters_latitude = dto.geoposition.lat.toFixed(8);
      data.headquarters_longitude = dto.geoposition.long.toFixed(8);
    }

    if (dto.headquarters) {
      const merged = MerchantsService.mergeHeadquartersPatch(
        {
          headquarters_first_line: existing.headquarters_first_line,
          headquarters_second_line: existing.headquarters_second_line,
          headquarters_zipcode: existing.headquarters_zipcode,
          headquarters_municipality: existing.headquarters_municipality,
          headquarters_state: existing.headquarters_state,
          headquarters_country: existing.headquarters_country,
        },
        dto.headquarters,
      );
      data.headquarters_first_line = merged.headquarters_first_line;
      data.headquarters_second_line = merged.headquarters_second_line;
      data.headquarters_zipcode = merged.headquarters_zipcode;
      data.headquarters_municipality = merged.headquarters_municipality;
      data.headquarters_state = merged.headquarters_state;
      data.headquarters_country = merged.headquarters_country;
      data.address = MerchantsService.hasCompleteHeadquartersCols(merged)
        ? MerchantsService.buildHeadquartersSummaryFromCols(merged)
        : null;
    }

    const merchant = await this.prisma.merchants.update({
      where: { id: merchantId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        owner_user_id: true,
        legal_representative_first_name: true,
        legal_representative_last_name: true,
        tax_id: true,
        headquarters_first_line: true,
        headquarters_second_line: true,
        headquarters_zipcode: true,
        headquarters_municipality: true,
        headquarters_state: true,
        headquarters_country: true,
        headquarters_latitude: true,
        headquarters_longitude: true,
        phone_number: true,
        address: true,
        timezone: true,
        created_at: true,
        updated_at: true,
      },
    });

    return MerchantsService.serializeMerchantRow(merchant);
  }

  private static slugifyBusinessName(raw: string): string {
    const trimmed = raw.trim();
    const ascii = trimmed
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase();
    const slug = ascii
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return slug.length > 0 ? slug : 'merchant';
  }

  private static buildHeadquartersSummaryFromDto(h: HeadquartersOnboardingDto): string {
    const line12 = [h.firstLine.trim(), h.secondLine?.trim()].filter(Boolean).join(', ');
    return `${line12}, ${h.zipcode.trim()} ${h.municipality.trim()}, ${h.state.trim()}, ${h.country.trim()}`;
  }

  private static mergeHeadquartersPatch(
    existing: {
      headquarters_first_line: string | null;
      headquarters_second_line: string | null;
      headquarters_zipcode: string | null;
      headquarters_municipality: string | null;
      headquarters_state: string | null;
      headquarters_country: string | null;
    },
    patch: UpdateHeadquartersOnboardingDto,
  ) {
    const pick = (next: string | undefined, prev: string | null) =>
      next !== undefined ? next.trim() : prev;
    const pickSecond = (next: string | undefined, prev: string | null) => {
      if (next === undefined) return prev;
      const t = next.trim();
      return t === '' ? null : t;
    };
    return {
      headquarters_first_line: pick(patch.firstLine, existing.headquarters_first_line),
      headquarters_second_line: pickSecond(patch.secondLine, existing.headquarters_second_line),
      headquarters_zipcode: pick(patch.zipcode, existing.headquarters_zipcode),
      headquarters_municipality: pick(patch.municipality, existing.headquarters_municipality),
      headquarters_state: pick(patch.state, existing.headquarters_state),
      headquarters_country: pick(patch.country, existing.headquarters_country),
    };
  }

  private static hasCompleteHeadquartersCols(c: {
    headquarters_first_line: string | null;
    headquarters_zipcode: string | null;
    headquarters_municipality: string | null;
    headquarters_state: string | null;
    headquarters_country: string | null;
  }): boolean {
    return [c.headquarters_first_line, c.headquarters_zipcode, c.headquarters_municipality, c.headquarters_state, c.headquarters_country].every(
      (v) => typeof v === 'string' && v.trim() !== '',
    );
  }

  private static buildHeadquartersSummaryFromCols(c: {
    headquarters_first_line: string | null;
    headquarters_second_line: string | null;
    headquarters_zipcode: string | null;
    headquarters_municipality: string | null;
    headquarters_state: string | null;
    headquarters_country: string | null;
  }): string {
    const first = c.headquarters_first_line!.trim();
    const line12 = [first, c.headquarters_second_line?.trim()].filter(Boolean).join(', ');
    return `${line12}, ${c.headquarters_zipcode!.trim()} ${c.headquarters_municipality!.trim()}, ${c.headquarters_state!.trim()}, ${c.headquarters_country!.trim()}`;
  }

  private static decimalLikeToNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(String(value));
    return Number.isFinite(n) ? n : null;
  }

  private static serializeMerchantRow(
    row: {
      id: string;
      name: string;
      slug: string;
      owner_user_id: string | null;
      legal_representative_first_name: string | null;
      legal_representative_last_name: string | null;
      tax_id: string | null;
      headquarters_first_line: string | null;
      headquarters_second_line: string | null;
      headquarters_zipcode: string | null;
      headquarters_municipality: string | null;
      headquarters_state: string | null;
      headquarters_country: string | null;
      headquarters_latitude: unknown;
      headquarters_longitude: unknown;
      phone_number: string | null;
      address: string | null;
      timezone: string;
      created_at: Date | null;
      updated_at: Date | null;
    },
  ) {
    return {
      ...row,
      headquarters_latitude: MerchantsService.decimalLikeToNumber(row.headquarters_latitude),
      headquarters_longitude: MerchantsService.decimalLikeToNumber(row.headquarters_longitude),
    };
  }

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
