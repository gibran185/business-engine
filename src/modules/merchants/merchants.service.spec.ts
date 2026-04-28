import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsService } from './merchants.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantStaffRole } from '../../tenancy/merchant-staff-role.enum.js';

describe('MerchantsService', () => {
  let service: MerchantsService;
  let prisma: {
    merchants: { findUnique: jest.Mock };
    merchant_staff: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      merchants: { findUnique: jest.fn() },
      merchant_staff: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
        fn({
          staff_services: { deleteMany: jest.fn() },
          staff_working_hours: { deleteMany: jest.fn() },
          merchant_staff: { delete: jest.fn() },
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
});
