import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppointmentsService } from './appointments.service.js';

const merchantId = '11111111-1111-1111-1111-111111111111';
const serviceId = '22222222-2222-2222-2222-222222222222';
const customerId = '33333333-3333-3333-3333-333333333333';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: {
    $executeRaw: ReturnType<typeof jest.fn>;
    $transaction: ReturnType<typeof jest.fn>;
    services: { findFirst: ReturnType<typeof jest.fn> };
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

  beforeEach(async () => {
    prisma = {
      $executeRaw: jest.fn(async () => 0),
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
      services: { findFirst: jest.fn() },
      appointments: { findMany: jest.fn(), create: jest.fn() },
    };
    logger = { info: jest.fn(), setContext: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PinoLogger, useValue: logger },
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

    prisma.appointments.findMany.mockResolvedValue([
      {
        start_time: new Date('2026-04-23T14:30:00.000Z'),
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

    prisma.appointments.findMany.mockResolvedValue([]);

    const created = {
      id: '44444444-4444-4444-4444-444444444444',
      merchant_id: merchantId,
      service_id: serviceId,
      customer_id: customerId,
      start_time: new Date('2026-04-23T14:00:00.000Z'),
      status: 'pending',
      created_at: new Date(),
    };
    prisma.appointments.create.mockResolvedValue(created);

    const result = await service.create(
      {
        merchantId,
        serviceId,
        startTime: '2026-04-23T14:00:00.000Z',
      },
      customerId,
    );

    expect(result).toEqual(created);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.appointments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchant_id: merchantId,
          service_id: serviceId,
          customer_id: customerId,
        }),
      }),
    );
  });
});
