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

type ExistingBlock = {
  start_time: Date;
  services: { duration_minutes: number } | null;
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(query: AvailabilityQueryDto) {
    const windowStart = new Date(query.windowStart);
    const windowEnd = new Date(query.windowEnd);

    if (!(windowStart.getTime() < windowEnd.getTime())) {
      throw new BadRequestException('windowStart must be before windowEnd');
    }

    const service = await this.prisma.services.findFirst({
      where: {
        id: query.serviceId,
        merchant_id: query.merchantId,
        is_active: true,
      },
    });

    if (!service?.merchant_id) {
      throw new NotFoundException('Service not found for this merchant');
    }

    const durationMinutes = service.duration_minutes;

    const existing = await this.prisma.appointments.findMany({
      where: {
        merchant_id: query.merchantId,
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
    });

    const slots: string[] = [];
    const stepMs = SLOT_STEP_MINUTES * 60_000;

    for (
      let t = windowStart.getTime();
      t < windowEnd.getTime();
      t += stepMs
    ) {
      const slotStart = new Date(t);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (slotEnd.getTime() > windowEnd.getTime()) {
        break;
      }
      if (!this.slotBlocked(slotStart, slotEnd, existing)) {
        slots.push(slotStart.toISOString());
      }
    }

    return {
      merchantId: query.merchantId,
      serviceId: query.serviceId,
      durationMinutes,
      slots,
    };
  }

  private slotBlocked(
    slotStart: Date,
    slotEnd: Date,
    existing: ExistingBlock[],
  ): boolean {
    for (const appt of existing) {
      const duration = appt.services?.duration_minutes ?? 30;
      const apptEnd = addMinutes(appt.start_time, duration);
      if (
        intervalsOverlapHalfOpen(
          slotStart,
          slotEnd,
          appt.start_time,
          apptEnd,
        )
      ) {
        return true;
      }
    }
    return false;
  }
}
