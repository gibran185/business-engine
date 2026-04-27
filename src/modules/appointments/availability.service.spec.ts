import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AvailabilityService } from './availability.service.js';

const merchantId = '11111111-1111-1111-1111-111111111111';
const serviceId = '22222222-2222-2222-2222-222222222222';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: {
    services: { findFirst: ReturnType<typeof jest.fn> };
    appointments: { findMany: ReturnType<typeof jest.fn> };
  };

  beforeEach(async () => {
    prisma = {
      services: { findFirst: jest.fn() },
      appointments: { findMany: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AvailabilityService);
  });

  describe('getAvailableSlotsForDate', () => {
    it('rejects non-existent calendar day', async () => {
      await expect(
        service.getAvailableSlotsForDate(merchantId, serviceId, '2026-02-30'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects bad format', async () => {
      await expect(
        service.getAvailableSlotsForDate(merchantId, serviceId, '24-04-2026'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns slots for an empty day with 30min service', async () => {
      prisma.services.findFirst.mockResolvedValue({
        id: serviceId,
        merchant_id: merchantId,
        duration_minutes: 30,
        is_active: true,
      });
      prisma.appointments.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlotsForDate(
        merchantId,
        serviceId,
        '2026-04-24',
      );

      expect(result.date).toBe('2026-04-24');
      expect(result.merchantId).toBe(merchantId);
      expect(result.serviceId).toBe(serviceId);
      expect(result.durationMinutes).toBe(30);
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.slots[0]).toBe('2026-04-24T00:00:00.000Z');
      expect(result.windowStart).toBe('2026-04-24T00:00:00.000Z');
      expect(result.windowEnd).toBe('2026-04-25T00:00:00.000Z');
    });

    it('throws when service is missing for merchant', async () => {
      prisma.services.findFirst.mockResolvedValue(null);
      await expect(
        service.getAvailableSlotsForDate(merchantId, serviceId, '2026-04-24'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getDayCalendarForDate', () => {
    it('returns FREE/BUSY slots for a day', async () => {
      prisma.services.findFirst.mockResolvedValue({
        id: serviceId,
        merchant_id: merchantId,
        duration_minutes: 30,
        is_active: true,
      });
      prisma.appointments.findMany.mockResolvedValue([
        {
          start_time: new Date('2026-04-24T00:00:00.000Z'),
          services: { duration_minutes: 30 },
        },
      ]);

      const result = await service.getDayCalendarForDate(
        merchantId,
        serviceId,
        '2026-04-24',
      );

      expect(result.date).toBe('2026-04-24');
      expect(result.stepMinutes).toBe(15);
      expect(result.windowStart).toBe('2026-04-24T00:00:00.000Z');
      expect(result.windowEnd).toBe('2026-04-25T00:00:00.000Z');
      expect(result.slots[0]).toEqual({
        start: '2026-04-24T00:00:00.000Z',
        end: '2026-04-24T00:30:00.000Z',
        status: 'BUSY',
      });
      expect(result.slots.some((s) => s.status === 'FREE')).toBe(true);
    });
  });

  describe('getStaffDayCalendarForDate', () => {
    it('aggregates available staff ids for a slot', async () => {
      prisma.merchants = { findUnique: jest.fn() } as any;
      prisma.staff_services = { findMany: jest.fn() } as any;
      prisma.staff_working_hours = { findMany: jest.fn() } as any;

      prisma.merchants.findUnique.mockResolvedValue({ id: merchantId, timezone: 'UTC' });
      prisma.services.findFirst.mockResolvedValue({
        id: serviceId,
        merchant_id: merchantId,
        duration_minutes: 30,
        is_active: true,
      });
      prisma.staff_services.findMany.mockResolvedValue([
        { merchant_staff_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        { merchant_staff_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' },
      ]);
      prisma.staff_working_hours.findMany.mockResolvedValue([
        { merchant_staff_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', start_minute: 0, end_minute: 24 * 60 },
        { merchant_staff_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', start_minute: 0, end_minute: 24 * 60 },
      ]);
      prisma.appointments.findMany.mockResolvedValue([]);

      const result = await service.getStaffDayCalendarForDate({
        merchantId,
        serviceId,
        date: '2026-04-24',
      });

      expect(result.mode).toBe('any_staff');
      if (result.mode !== 'any_staff') return;
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.slots[0].status).toBe('FREE');
      expect(result.slots[0].availableStaffIds.length).toBe(2);
    });
  });
});
