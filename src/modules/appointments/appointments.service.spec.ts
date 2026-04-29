import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CustomerRelationsService } from '../customers/customer-relations.service.js';
import { AppointmentsService } from './appointments.service.js';

const merchantId = '11111111-1111-1111-1111-111111111111';
const serviceId = '22222222-2222-2222-2222-222222222222';
const customerId = '33333333-3333-3333-3333-333333333333';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: {
    $executeRaw: ReturnType<typeof jest.fn>;
    $queryRaw: ReturnType<typeof jest.fn>;
    $transaction: ReturnType<typeof jest.fn>;
    merchants: { findUnique: ReturnType<typeof jest.fn> };
    services: { findFirst: ReturnType<typeof jest.fn> };
    staff_services: { findMany: ReturnType<typeof jest.fn> };
    staff_working_hours: { findMany: ReturnType<typeof jest.fn> };
    customer_profiles: { upsert: ReturnType<typeof jest.fn> };
    merchant_customers: { upsert: ReturnType<typeof jest.fn> };
    appointments: {
      findMany: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
    };
  };
  let logger: {
    info: ReturnType<typeof jest.fn>;
    setContext: ReturnType<typeof jest.fn>;
    warn: ReturnType<typeof jest.fn>;
  };
  let customerRelations: {
    ensureCustomerMerchantRelation: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    prisma = {
      $executeRaw: jest.fn(async () => 0),
      $queryRaw: jest.fn(async () => [{ locked: true }]),
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
      merchants: { findUnique: jest.fn() },
      services: { findFirst: jest.fn() },
      staff_services: { findMany: jest.fn() },
      staff_working_hours: { findMany: jest.fn() },
      customer_profiles: { upsert: jest.fn() },
      merchant_customers: { upsert: jest.fn() },
      appointments: { findMany: jest.fn(), create: jest.fn() },
    };
    logger = { info: jest.fn(), setContext: jest.fn(), warn: jest.fn() };
    customerRelations = {
      ensureCustomerMerchantRelation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PinoLogger, useValue: logger },
        { provide: CustomerRelationsService, useValue: customerRelations },
      ],
    }).compile();

    service = module.get(AppointmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create throws NotFound when service does not belong to merchant', async () => {
    prisma.services.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          merchantId,
          serviceId,
          startTime: '2026-04-23T14:00:00.000Z',
        },
        customerId,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create throws Conflict when slot overlaps an existing appointment', async () => {
    prisma.services.findFirst.mockResolvedValue({
      id: serviceId,
      merchant_id: merchantId,
      duration_minutes: 60,
      is_active: true,
    });
    prisma.merchants.findUnique.mockResolvedValue({ id: merchantId, timezone: 'UTC' });
    prisma.staff_services.findMany.mockResolvedValue([
      { merchant_staff_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    ]);
    prisma.staff_working_hours.findMany.mockResolvedValue([
      { start_minute: 0, end_minute: 24 * 60 },
    ]);

    prisma.appointments.findMany.mockResolvedValue([
      {
        start_time: new Date('2026-04-23T14:30:00.000Z'),
        end_time: null,
        duration_minutes: null,
        merchant_staff_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        services: { duration_minutes: 30 },
      },
    ]);

    await expect(
      service.create(
        {
          merchantId,
          serviceId,
          startTime: '2026-04-23T14:00:00.000Z',
        },
        customerId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create persists appointment when slot is free', async () => {
    prisma.services.findFirst.mockResolvedValue({
      id: serviceId,
      merchant_id: merchantId,
      duration_minutes: 60,
      is_active: true,
    });
    prisma.merchants.findUnique.mockResolvedValue({ id: merchantId, timezone: 'UTC' });
    prisma.staff_services.findMany.mockResolvedValue([
      { merchant_staff_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    ]);
    prisma.staff_working_hours.findMany.mockResolvedValue([
      { start_minute: 0, end_minute: 24 * 60 },
    ]);

    prisma.appointments.findMany.mockResolvedValue([]);

    const created = {
      id: '44444444-4444-4444-4444-444444444444',
      merchant_id: merchantId,
      service_id: serviceId,
      merchant_staff_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      customer_id: customerId,
      start_time: new Date('2026-04-23T14:00:00.000Z'),
      end_time: new Date('2026-04-23T15:00:00.000Z'),
      duration_minutes: 60,
      status: 'pending',
      created_at: new Date(),
    };
    prisma.appointments.create.mockResolvedValue(created);
    customerRelations.ensureCustomerMerchantRelation.mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      merchant_id: merchantId,
      customer_id: customerId,
    });

    const result = await service.create(
      {
        merchantId,
        serviceId,
        startTime: '2026-04-23T14:00:00.000Z',
      },
      customerId,
      'customer@example.com',
    );

    expect(result).toEqual(created);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
    expect(prisma.appointments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant_id: merchantId,
          service_id: serviceId,
          customer_id: customerId,
        }),
      }),
    );
    expect(customerRelations.ensureCustomerMerchantRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId,
        customerId,
        customerEmail: 'customer@example.com',
      }),
      prisma,
    );
  });

  it('auto-assign picks a different free staff when first is busy', async () => {
    prisma.services.findFirst.mockResolvedValue({
      id: serviceId,
      merchant_id: merchantId,
      duration_minutes: 60,
      is_active: true,
    });
    prisma.merchants.findUnique.mockResolvedValue({ id: merchantId, timezone: 'UTC' });

    const staffA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const staffB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    prisma.staff_services.findMany.mockResolvedValue([
      { merchant_staff_id: staffA },
      { merchant_staff_id: staffB },
    ]);
    prisma.staff_working_hours.findMany.mockResolvedValue([
      { start_minute: 0, end_minute: 24 * 60 },
    ]);

    prisma.appointments.findMany.mockImplementation(async (args: any) => {
      const staffFilter = args?.where?.OR?.[1]?.merchant_staff_id;
      if (staffFilter === staffA) {
        return [
          {
            start_time: new Date('2026-04-23T14:30:00.000Z'),
            end_time: null,
            duration_minutes: null,
            merchant_staff_id: staffA,
            services: { duration_minutes: 30 },
          },
        ];
      }
      return [];
    });

    prisma.appointments.create.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      merchant_id: merchantId,
      service_id: serviceId,
      merchant_staff_id: staffB,
      customer_id: customerId,
      start_time: new Date('2026-04-23T14:00:00.000Z'),
      end_time: new Date('2026-04-23T15:00:00.000Z'),
      duration_minutes: 60,
      status: 'pending',
      created_at: new Date(),
    });
    customerRelations.ensureCustomerMerchantRelation.mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
    });

    const result = await service.create(
      {
        merchantId,
        serviceId,
        startTime: '2026-04-23T14:00:00.000Z',
      },
      customerId,
    );

    expect(result.merchant_staff_id).toBe(staffB);
  });

  it('rejects when explicit staff is not eligible for the service', async () => {
    prisma.services.findFirst.mockResolvedValue({
      id: serviceId,
      merchant_id: merchantId,
      duration_minutes: 60,
      is_active: true,
    });
    prisma.merchants.findUnique.mockResolvedValue({ id: merchantId, timezone: 'UTC' });

    prisma.staff_services.findMany.mockResolvedValue([
      { merchant_staff_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
    ]);

    await expect(
      service.create(
        {
          merchantId,
          serviceId,
          startTime: '2026-04-23T14:00:00.000Z',
          staffId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        },
        customerId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when explicit staff is outside working hours', async () => {
    prisma.services.findFirst.mockResolvedValue({
      id: serviceId,
      merchant_id: merchantId,
      duration_minutes: 60,
      is_active: true,
    });
    prisma.merchants.findUnique.mockResolvedValue({ id: merchantId, timezone: 'UTC' });

    const staffA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    prisma.staff_services.findMany.mockResolvedValue([{ merchant_staff_id: staffA }]);
    prisma.staff_working_hours.findMany.mockResolvedValue([
      // window not covering 14:00
      { start_minute: 0, end_minute: 60 },
    ]);

    await expect(
      service.create(
        {
          merchantId,
          serviceId,
          startTime: '2026-04-23T14:00:00.000Z',
          staffId: staffA,
        },
        customerId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
