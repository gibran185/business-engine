import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsService } from './merchants.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantStaffRole } from '../../tenancy/merchant-staff-role.enum.js';

describe('MerchantsService', () => {
  let service: MerchantsService;
  let prisma: {
    merchants: { findUnique: jest.Mock; create: jest.Mock };
    merchant_staff: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    merchant_customers: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const merchants = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const merchant_staff = {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    prisma = {
      merchants,
      merchant_staff,
      merchant_customers: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          merchants,
          merchant_staff,
          staff_services: { deleteMany: jest.fn() },
          staff_working_hours: { deleteMany: jest.fn() },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantsService,
        {
          provide: PrismaService,
          useValue: prisma as unknown as PrismaService,
        },
      ],
    }).compile();

    service = module.get<MerchantsService>(MerchantsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const onboardingDto = {
    businessName: 'Acme Spa',
    legalRepresentative: { firstName: 'Jane', lastName: 'Doe' },
    taxId: ' TAX123 ',
    headquarters: {
      firstLine: '123 Main St',
      secondLine: 'Floor 2',
      zipcode: '01000',
      municipality: 'CDMX',
      state: 'CMX',
      country: 'MX',
    },
    businessPhone: ' +525555555555 ',
    geoposition: { lat: 19.432608, long: -99.133209 },
  };

  it('onboarding creates merchant, owner fields, and admin staff', async () => {
    prisma.merchants.findUnique.mockResolvedValue(null);
    prisma.merchants.create.mockResolvedValue({
      id: 'm-new',
      name: 'Acme Spa',
      slug: 'acme-spa',
      owner_user_id: 'u-owner',
      legal_representative_first_name: 'Jane',
      legal_representative_last_name: 'Doe',
      tax_id: 'TAX123',
      headquarters_first_line: '123 Main St',
      headquarters_second_line: 'Floor 2',
      headquarters_zipcode: '01000',
      headquarters_municipality: 'CDMX',
      headquarters_state: 'CMX',
      headquarters_country: 'MX',
      headquarters_latitude: '19.43260800',
      headquarters_longitude: '-99.13320900',
      phone_number: '+525555555555',
      address: '123 Main St, Floor 2, 01000 CDMX, CMX, MX',
      timezone: 'UTC',
      created_at: new Date(),
      updated_at: new Date(),
    });
    prisma.merchant_staff.create.mockResolvedValue({
      id: 'ms-new',
      merchant_id: 'm-new',
      user_id: 'u-owner',
      role: MerchantStaffRole.ADMIN,
      created_at: new Date(),
    });

    const res = await service.onboarding(
      { userId: 'u-owner', email: 'owner@test.com' },
      onboardingDto,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.merchants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Acme Spa',
          slug: 'acme-spa',
          owner_user_id: 'u-owner',
          legal_representative_first_name: 'Jane',
          legal_representative_last_name: 'Doe',
          tax_id: 'TAX123',
          phone_number: '+525555555555',
        }),
      }),
    );
    expect(prisma.merchant_staff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant_id: 'm-new',
          user_id: 'u-owner',
          role: MerchantStaffRole.ADMIN,
        }),
      }),
    );
    expect(res.staff.role).toBe(MerchantStaffRole.ADMIN);
    expect(res.merchant.headquarters_latitude).toBeCloseTo(19.432608);
    expect(res.merchant.headquarters_longitude).toBeCloseTo(-99.133209);
  });

  it('onboarding with only businessName leaves optional columns null', async () => {
    prisma.merchants.findUnique.mockResolvedValue(null);
    prisma.merchants.create.mockResolvedValue({
      id: 'm-partial',
      name: 'Solo Shop',
      slug: 'solo-shop',
      owner_user_id: 'u-owner',
      legal_representative_first_name: null,
      legal_representative_last_name: null,
      tax_id: null,
      headquarters_first_line: null,
      headquarters_second_line: null,
      headquarters_zipcode: null,
      headquarters_municipality: null,
      headquarters_state: null,
      headquarters_country: null,
      headquarters_latitude: null,
      headquarters_longitude: null,
      phone_number: null,
      address: null,
      timezone: 'UTC',
      created_at: new Date(),
      updated_at: new Date(),
    });
    prisma.merchant_staff.create.mockResolvedValue({
      id: 'ms-p',
      merchant_id: 'm-partial',
      user_id: 'u-owner',
      role: MerchantStaffRole.ADMIN,
      created_at: new Date(),
    });

    await service.onboarding({ userId: 'u-owner' }, { businessName: 'Solo Shop' });

    expect(prisma.merchants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Solo Shop',
          slug: 'solo-shop',
          owner_user_id: 'u-owner',
          legal_representative_first_name: null,
          legal_representative_last_name: null,
          tax_id: null,
          phone_number: null,
          headquarters_first_line: null,
          address: null,
          headquarters_latitude: null,
          headquarters_longitude: null,
        }),
      }),
    );
  });

  it('updateMerchantOnboarding merges headquarters and rebuilds address when complete', async () => {
    prisma.merchants.findUnique.mockResolvedValue({
      id: 'm1',
      name: 'Acme',
      slug: 'acme',
      owner_user_id: 'u1',
      legal_representative_first_name: null,
      legal_representative_last_name: null,
      tax_id: null,
      headquarters_first_line: null,
      headquarters_second_line: null,
      headquarters_zipcode: null,
      headquarters_municipality: null,
      headquarters_state: null,
      headquarters_country: null,
      headquarters_latitude: null,
      headquarters_longitude: null,
      phone_number: null,
      address: null,
      timezone: 'UTC',
      created_at: new Date(),
      updated_at: new Date(),
    });
    prisma.merchants.update.mockResolvedValue({
      id: 'm1',
      name: 'Acme',
      slug: 'acme',
      owner_user_id: 'u1',
      legal_representative_first_name: 'Maria',
      legal_representative_last_name: 'Lopez',
      tax_id: null,
      headquarters_first_line: 'Av. Reforma 123',
      headquarters_second_line: null,
      headquarters_zipcode: '01000',
      headquarters_municipality: 'Ciudad de México',
      headquarters_state: 'CDMX',
      headquarters_country: 'Mexico',
      headquarters_latitude: '19.43260800',
      headquarters_longitude: '-99.13320900',
      phone_number: '+525555555555',
      address: 'Av. Reforma 123, 01000 Ciudad de México, CDMX, Mexico',
      timezone: 'UTC',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await service.updateMerchantOnboarding('m1', {
      legalRepresentative: { firstName: 'Maria', lastName: 'Lopez' },
      businessPhone: '+525555555555',
      headquarters: {
        firstLine: 'Av. Reforma 123',
        zipcode: '01000',
        municipality: 'Ciudad de México',
        state: 'CDMX',
        country: 'Mexico',
      },
      geoposition: { lat: 19.432608, long: -99.133209 },
    });

    expect(prisma.merchants.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({
          legal_representative_first_name: 'Maria',
          legal_representative_last_name: 'Lopez',
          phone_number: '+525555555555',
          headquarters_first_line: 'Av. Reforma 123',
          address: 'Av. Reforma 123, 01000 Ciudad de México, CDMX, Mexico',
        }),
      }),
    );
    expect(res.phone_number).toBe('+525555555555');
    expect(res.address).toBe('Av. Reforma 123, 01000 Ciudad de México, CDMX, Mexico');
  });

  it('onboarding bumps slug when base slug is taken', async () => {
    prisma.merchants.findUnique.mockImplementation(async (args: { where: { slug: string } }) => {
      if (args.where.slug === 'acme-spa') return { id: 'taken' };
      return null;
    });
    prisma.merchants.create.mockResolvedValue({
      id: 'm2',
      name: 'Acme Spa',
      slug: 'acme-spa-1',
      owner_user_id: 'u1',
      legal_representative_first_name: 'J',
      legal_representative_last_name: 'D',
      tax_id: null,
      headquarters_first_line: 'L',
      headquarters_second_line: null,
      headquarters_zipcode: 'z',
      headquarters_municipality: 'm',
      headquarters_state: 's',
      headquarters_country: 'c',
      headquarters_latitude: '1',
      headquarters_longitude: '2',
      phone_number: 'p',
      address: 'a',
      timezone: 'UTC',
      created_at: new Date(),
      updated_at: new Date(),
    });
    prisma.merchant_staff.create.mockResolvedValue({
      id: 'ms',
      merchant_id: 'm2',
      user_id: 'u1',
      role: MerchantStaffRole.ADMIN,
      created_at: new Date(),
    });

    await service.onboarding({ userId: 'u1' }, onboardingDto);

    expect(prisma.merchants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'acme-spa-1' }),
      }),
    );
  });

  it('creates merchant staff row', async () => {
    prisma.merchants.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchant_staff.create.mockResolvedValue({
      id: 'ms1',
      merchant_id: 'm1',
      user_id: 'u1',
      role: MerchantStaffRole.ADMIN,
      created_at: new Date(),
    });

    const res = await service.createMerchantStaff('m1', {
      userId: 'u1',
      role: MerchantStaffRole.ADMIN,
    });

    expect(prisma.merchants.findUnique).toHaveBeenCalledWith({
      where: { id: 'm1' },
      select: { id: true },
    });
    expect(prisma.merchant_staff.create).toHaveBeenCalled();
    expect(res.role).toBe(MerchantStaffRole.ADMIN);
  });

  it('lists merchant staff', async () => {
    prisma.merchants.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchant_staff.findMany.mockResolvedValue([
      {
        id: 'ms1',
        merchant_id: 'm1',
        user_id: 'u1',
        role: MerchantStaffRole.ADMIN,
        created_at: new Date(),
      },
      {
        id: 'ms2',
        merchant_id: 'm1',
        user_id: 'u2',
        role: MerchantStaffRole.EMPLOYEE,
        created_at: new Date(),
      },
    ]);

    const rows = await service.listMerchantStaff('m1');
    expect(prisma.merchant_staff.findMany).toHaveBeenCalledWith({
      where: { merchant_id: 'm1' },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        merchant_id: true,
        user_id: true,
        role: true,
        created_at: true,
      },
    });
    expect(rows).toHaveLength(2);
  });

  it('updates merchant staff role', async () => {
    prisma.merchant_staff.findFirst.mockResolvedValue({
      id: 'ms1',
      role: MerchantStaffRole.EMPLOYEE,
    });
    prisma.merchant_staff.update.mockResolvedValue({
      id: 'ms1',
      merchant_id: 'm1',
      user_id: 'u1',
      role: MerchantStaffRole.SUPERVISOR,
      created_at: new Date(),
    });

    const res = await service.updateMerchantStaff('m1', 'ms1', {
      role: MerchantStaffRole.SUPERVISOR,
    });

    expect(prisma.merchant_staff.update).toHaveBeenCalledWith({
      where: { id: 'ms1' },
      data: { role: MerchantStaffRole.SUPERVISOR },
      select: {
        id: true,
        merchant_id: true,
        user_id: true,
        role: true,
        created_at: true,
      },
    });
    expect(res.role).toBe(MerchantStaffRole.SUPERVISOR);
  });

  it('rejects demoting the last admin', async () => {
    prisma.merchant_staff.findFirst.mockResolvedValue({
      id: 'ms1',
      role: MerchantStaffRole.ADMIN,
    });
    prisma.merchant_staff.count.mockResolvedValue(1);

    await expect(
      service.updateMerchantStaff('m1', 'ms1', {
        role: MerchantStaffRole.EMPLOYEE,
      }),
    ).rejects.toThrow('last admin');
    expect(prisma.merchant_staff.update).not.toHaveBeenCalled();
  });

  it('removes merchant staff in a transaction', async () => {
    prisma.merchant_staff.findFirst.mockResolvedValue({
      id: 'ms1',
      role: MerchantStaffRole.EMPLOYEE,
    });
    prisma.merchant_staff.count.mockResolvedValue(2);

    await service.removeMerchantStaff('m1', 'ms1');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects deleting the last admin', async () => {
    prisma.merchant_staff.findFirst.mockResolvedValue({
      id: 'ms1',
      role: MerchantStaffRole.ADMIN,
    });
    prisma.merchant_staff.count.mockResolvedValue(1);

    await expect(service.removeMerchantStaff('m1', 'ms1')).rejects.toThrow(
      'last admin',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists merchant customers with PII for admin/supervisor', async () => {
    prisma.merchants.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchant_staff.findFirst.mockResolvedValue({
      role: MerchantStaffRole.SUPERVISOR,
    });
    prisma.merchant_customers.findMany.mockResolvedValue([
      {
        customer_id: 'c1',
        first_seen_at: new Date('2026-04-20T10:00:00.000Z'),
        last_seen_at: new Date('2026-04-25T10:00:00.000Z'),
        status: 'active',
        customer_profiles: {
          full_name: 'Ana Perez',
          email: 'ana@example.com',
          phone_number: '+521111111111',
        },
      },
    ]);

    const rows = await service.listMerchantCustomers('m1', 'u-supervisor');
    expect(rows[0]).toEqual(
      expect.objectContaining({
        customerId: 'c1',
        email: 'ana@example.com',
        phoneNumber: '+521111111111',
        status: 'active',
      }),
    );
  });

  it('lists merchant customers with redacted PII for employees', async () => {
    prisma.merchants.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchant_staff.findFirst.mockResolvedValue({
      role: MerchantStaffRole.EMPLOYEE,
    });
    prisma.merchant_customers.findMany.mockResolvedValue([
      {
        customer_id: 'c1',
        first_seen_at: new Date('2026-04-20T10:00:00.000Z'),
        last_seen_at: new Date('2026-04-25T10:00:00.000Z'),
        status: 'unsubscribed',
        customer_profiles: {
          full_name: 'Ana Perez',
          email: 'ana@example.com',
          phone_number: '+521111111111',
        },
      },
    ]);

    const rows = await service.listMerchantCustomers('m1', 'u-employee');
    expect(rows[0]).toEqual(
      expect.objectContaining({
        customerId: 'c1',
        email: null,
        phoneNumber: null,
        status: 'unsubscribed',
      }),
    );
  });

  it('updates merchant customer status to blocked', async () => {
    prisma.merchants.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.merchant_customers.findUnique.mockResolvedValue({ id: 'mc1' });
    prisma.merchant_customers.update.mockResolvedValue({
      id: 'mc1',
      merchant_id: 'm1',
      customer_id: 'c1',
      status: 'blocked',
      first_seen_at: new Date('2026-04-20T10:00:00.000Z'),
      last_seen_at: new Date('2026-04-25T10:00:00.000Z'),
    });

    const row = await service.updateMerchantCustomerStatus('m1', 'c1', 'blocked');
    expect(row.status).toBe('blocked');
    expect(prisma.merchant_customers.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'blocked' }),
      }),
    );
  });
});
