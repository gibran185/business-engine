import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CANCELLED_APPOINTMENT_STATUSES,
  MAX_SERVICE_DURATION_MINUTES,
  SLOT_STEP_MINUTES,
} from './appointments.constants.js';
import type { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { addMinutes, intervalsOverlapHalfOpen } from './time-interval.util.js';

type Block = { start: Date; end: Date };

/** Result of `GET /appointments/available-slots` (UTC calendar day + window bounds). */
export type AvailableSlotsResult = {
  merchantId: string;
  serviceId: string;
  durationMinutes: number;
  slots: string[];
  date: string;
  windowStart: string;
  windowEnd: string;
};

/** Result of `GET /appointments/availability` (custom window; unchanged contract). */
export type AvailabilityResult = {
  merchantId: string;
  serviceId: string;
  durationMinutes: number;
  slots: string[];
};

type ComputedSlotWindow = {
  merchantId: string;
  serviceId: string;
  durationMinutes: number;
  slots: string[];
  windowStart: string;
  windowEnd: string;
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(query: AvailabilityQueryDto): Promise<AvailabilityResult> {
    const windowStart = new Date(query.windowStart);
    const windowEnd = new Date(query.windowEnd);
    this.assertValidWindow(windowStart, windowEnd);
    const full = await this.computeSlots({
      merchantId: query.merchantId,
      serviceId: query.serviceId,
      windowStart,
      windowEnd,
    });
    return {
      merchantId: full.merchantId,
      serviceId: full.serviceId,
      durationMinutes: full.durationMinutes,
      slots: full.slots,
    };
  }

  /**
   * High-traffic endpoint: one calendar day in UTC. Uses the same engine as
   * {@link getAvailability} with a narrow time range and the same indexed query shape.
   */
  async getAvailableSlotsForDate(
    merchantId: string,
    serviceId: string,
    date: string,
  ): Promise<AvailableSlotsResult> {
    const { windowStart, windowEnd } = this.utcDayBoundsFromDateOnly(date);
    const full = await this.computeSlots({
      merchantId,
      serviceId,
      windowStart,
      windowEnd,
    });
    return {
      merchantId: full.merchantId,
      serviceId: full.serviceId,
      durationMinutes: full.durationMinutes,
      slots: full.slots,
      date,
      windowStart: full.windowStart,
      windowEnd: full.windowEnd,
    };
  }

  private utcDayBoundsFromDateOnly(date: string): { windowStart: Date; windowEnd: Date } {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!parts) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const y = Number(parts[1]);
    const m = Number(parts[2]);
    const d = Number(parts[3]);
    const windowStart = new Date(Date.UTC(y, m - 1, d));
    if (
      windowStart.getUTCFullYear() !== y ||
      windowStart.getUTCMonth() !== m - 1 ||
      windowStart.getUTCDate() !== d
    ) {
      throw new BadRequestException('Invalid calendar date');
    }
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60_000);
    return { windowStart, windowEnd };
  }

  private assertValidWindow(windowStart: Date, windowEnd: Date) {
    if (!(windowStart.getTime() < windowEnd.getTime())) {
      throw new BadRequestException('windowStart must be before windowEnd');
    }
  }

  private async computeSlots(args: {
    merchantId: string;
    serviceId: string;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<ComputedSlotWindow> {
    const { merchantId, serviceId, windowStart, windowEnd } = args;

    const service = await this.prisma.services.findFirst({
      where: {
        id: serviceId,
        merchant_id: merchantId,
        is_active: true,
      },
    });

    if (!service?.merchant_id) {
      throw new NotFoundException('Service not found for this merchant');
    }

    const durationMinutes = service.duration_minutes;

    // Single range scan: index on (merchant_id, start_time) keeps this off the full table.
    const existing = await this.prisma.appointments.findMany({
      where: {
        merchant_id: merchantId,
        status: { notIn: [...CANCELLED_APPOINTMENT_STATUSES] },
        start_time: {
          gte: addMinutes(windowStart, -MAX_SERVICE_DURATION_MINUTES),
          lt: addMinutes(windowEnd, MAX_SERVICE_DURATION_MINUTES),
        },
      },
      select: {
        start_time: true,
        services: { select: { duration_minutes: true } },
      },
      orderBy: { start_time: 'asc' },
    });

    const blocks = this.toBlocks(existing);

    const slots: string[] = [];
    const stepMs = SLOT_STEP_MINUTES * 60_000;
    const windowEndMs = windowEnd.getTime();

    for (let t = windowStart.getTime(); t < windowEndMs; t += stepMs) {
      const slotStart = new Date(t);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (slotEnd.getTime() > windowEndMs) {
        break;
      }
      if (!this.slotBlocked(slotStart, slotEnd, blocks)) {
        slots.push(slotStart.toISOString());
      }
    }

    return {
      merchantId,
      serviceId,
      durationMinutes,
      slots,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    };
  }

  private toBlocks(
    existing: {
      start_time: Date;
      services: { duration_minutes: number } | null;
    }[],
  ): Block[] {
    return existing.map((appt) => {
      const d = appt.services?.duration_minutes ?? 30;
      return {
        start: appt.start_time,
        end: addMinutes(appt.start_time, d),
      };
    });
  }

  private slotBlocked(
    slotStart: Date,
    slotEnd: Date,
    blocks: Block[],
  ): boolean {
    for (const b of blocks) {
      if (
        intervalsOverlapHalfOpen(slotStart, slotEnd, b.start, b.end)
      ) {
        return true;
      }
    }
    return false;
  }
}
