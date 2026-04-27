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

export type DayCalendarSlotStatus = 'FREE' | 'BUSY';

export type DayCalendarSlot = {
  start: string;
  end: string;
  status: DayCalendarSlotStatus;
};

/** Result of `GET /appointments/day-calendar` (UTC calendar day; includes FREE/BUSY slots). */
export type DayCalendarResult = {
  merchantId: string;
  serviceId: string;
  date: string;
  durationMinutes: number;
  stepMinutes: number;
  windowStart: string;
  windowEnd: string;
  slots: DayCalendarSlot[];
};

export type StaffAggregateSlotStatus = 'FREE' | 'BUSY' | 'UNAVAILABLE';

export type StaffAggregateDayCalendarSlot = {
  start: string;
  end: string;
  status: StaffAggregateSlotStatus;
  /** Eligible staff who are working and free for this slot. */
  availableStaffIds: string[];
};

export type StaffDayCalendarResult =
  | {
      mode: 'single_staff';
      merchantId: string;
      serviceId: string;
      staffId: string;
      date: string;
      durationMinutes: number;
      stepMinutes: number;
      timezone: string;
      windowStart: string;
      windowEnd: string;
      slots: DayCalendarSlot[];
    }
  | {
      mode: 'any_staff';
      merchantId: string;
      serviceId: string;
      date: string;
      durationMinutes: number;
      stepMinutes: number;
      timezone: string;
      windowStart: string;
      windowEnd: string;
      slots: StaffAggregateDayCalendarSlot[];
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

  async getDayCalendarForDate(
    merchantId: string,
    serviceId: string,
    date: string,
  ): Promise<DayCalendarResult> {
    const { windowStart, windowEnd } = this.utcDayBoundsFromDateOnly(date);
    const full = await this.computeCalendar({
      merchantId,
      serviceId,
      windowStart,
      windowEnd,
    });

    return {
      merchantId: full.merchantId,
      serviceId: full.serviceId,
      date,
      durationMinutes: full.durationMinutes,
      stepMinutes: SLOT_STEP_MINUTES,
      windowStart: full.windowStart,
      windowEnd: full.windowEnd,
      slots: full.slots,
    };
  }

  async getStaffDayCalendarForDate(args: {
    merchantId: string;
    serviceId: string;
    date: string;
    staffId?: string;
  }): Promise<StaffDayCalendarResult> {
    const { merchantId, serviceId, date, staffId } = args;

    const merchant = await this.prisma.merchants.findUnique({
      where: { id: merchantId },
      select: { id: true, timezone: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    const timezone = merchant.timezone || 'UTC';

    const { windowStart, windowEnd } = this.zonedDayBoundsFromDateOnly(
      date,
      timezone,
    );

    // Resolve service duration.
    const service = await this.prisma.services.findFirst({
      where: { id: serviceId, merchant_id: merchantId, is_active: true },
      select: { id: true, duration_minutes: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found for this merchant');
    }
    const durationMinutes = service.duration_minutes;

    // Eligible staff for the service.
    const eligibleRows = await this.prisma.staff_services.findMany({
      where: { merchant_id: merchantId, service_id: serviceId },
      select: { merchant_staff_id: true },
      orderBy: { created_at: 'asc' },
    });
    const eligibleStaffIds = eligibleRows
      .map((r) => r.merchant_staff_id)
      .filter((id): id is string => typeof id === 'string');

    if (eligibleStaffIds.length === 0) {
      // No one can perform it: everything is UNAVAILABLE (or empty list).
      return {
        mode: 'any_staff',
        merchantId,
        serviceId,
        date,
        durationMinutes,
        stepMinutes: SLOT_STEP_MINUTES,
        timezone,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        slots: [],
      };
    }

    if (staffId) {
      if (!eligibleStaffIds.includes(staffId)) {
        throw new NotFoundException(
          'Staff is not eligible to perform this service',
        );
      }
    }

    const staffIdsToConsider = staffId ? [staffId] : eligibleStaffIds;

    // Load working hours for all relevant staff for this day-of-week.
    const dow = this.getZonedDayOfWeek(windowStart, timezone);
    const workingRows = await this.prisma.staff_working_hours.findMany({
      where: {
        merchant_id: merchantId,
        merchant_staff_id: { in: staffIdsToConsider },
        day_of_week: dow,
        is_active: true,
      },
      select: {
        merchant_staff_id: true,
        start_minute: true,
        end_minute: true,
      },
    });

    const workingByStaff = new Map<string, { start: number; end: number }[]>();
    for (const r of workingRows) {
      if (!r.merchant_staff_id) continue;
      const list = workingByStaff.get(r.merchant_staff_id) ?? [];
      list.push({ start: r.start_minute, end: r.end_minute });
      workingByStaff.set(r.merchant_staff_id, list);
    }

    // Load blocking appointments:
    // - global blocks: legacy appointments with NULL merchant_staff_id
    // - staff blocks: appointments assigned to each staff
    const existing = await this.prisma.appointments.findMany({
      where: {
        merchant_id: merchantId,
        status: { notIn: [...CANCELLED_APPOINTMENT_STATUSES] },
        start_time: {
          gte: addMinutes(windowStart, -MAX_SERVICE_DURATION_MINUTES),
          lt: addMinutes(windowEnd, MAX_SERVICE_DURATION_MINUTES),
        },
        OR: [
          { merchant_staff_id: null },
          { merchant_staff_id: { in: staffIdsToConsider } },
        ],
      },
      select: {
        start_time: true,
        end_time: true,
        duration_minutes: true,
        merchant_staff_id: true,
        services: { select: { duration_minutes: true } },
      },
      orderBy: { start_time: 'asc' },
    });

    const globalBlocks: Block[] = [];
    const staffBlocks = new Map<string, Block[]>();
    for (const appt of existing) {
      const start = appt.start_time;
      const end =
        appt.end_time ??
        addMinutes(
          appt.start_time,
          appt.duration_minutes ?? appt.services?.duration_minutes ?? 30,
        );

      if (!appt.merchant_staff_id) {
        globalBlocks.push({ start, end });
        continue;
      }
      const list = staffBlocks.get(appt.merchant_staff_id) ?? [];
      list.push({ start, end });
      staffBlocks.set(appt.merchant_staff_id, list);
    }

    const stepMs = SLOT_STEP_MINUTES * 60_000;
    const windowEndMs = windowEnd.getTime();

    if (staffId) {
      const blocks = [...globalBlocks, ...(staffBlocks.get(staffId) ?? [])];
      const slots: DayCalendarSlot[] = [];
      for (let t = windowStart.getTime(); t < windowEndMs; t += stepMs) {
        const slotStart = new Date(t);
        const slotEnd = addMinutes(slotStart, durationMinutes);
        if (slotEnd.getTime() > windowEndMs) break;

        const working = this.slotWithinWorkingHours(
          slotStart,
          slotEnd,
          timezone,
          workingByStaff.get(staffId) ?? [],
        );
        if (!working) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            status: 'BUSY',
          });
          continue;
        }

        const blocked = this.slotBlocked(slotStart, slotEnd, blocks);
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          status: blocked ? 'BUSY' : 'FREE',
        });
      }

      return {
        mode: 'single_staff',
        merchantId,
        serviceId,
        staffId,
        date,
        durationMinutes,
        stepMinutes: SLOT_STEP_MINUTES,
        timezone,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        slots,
      };
    }

    const slots: StaffAggregateDayCalendarSlot[] = [];

    for (let t = windowStart.getTime(); t < windowEndMs; t += stepMs) {
      const slotStart = new Date(t);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (slotEnd.getTime() > windowEndMs) break;

      const availableStaffIds: string[] = [];
      let workingEligibleCount = 0;

      for (const sid of staffIdsToConsider) {
        const working = this.slotWithinWorkingHours(
          slotStart,
          slotEnd,
          timezone,
          workingByStaff.get(sid) ?? [],
        );
        if (!working) continue;
        workingEligibleCount++;

        const blocks = [...globalBlocks, ...(staffBlocks.get(sid) ?? [])];
        if (!this.slotBlocked(slotStart, slotEnd, blocks)) {
          availableStaffIds.push(sid);
        }
      }

      const status: StaffAggregateSlotStatus =
        workingEligibleCount === 0
          ? 'UNAVAILABLE'
          : availableStaffIds.length === 0
            ? 'BUSY'
            : 'FREE';

      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        status,
        availableStaffIds,
      });
    }

    return {
      mode: 'any_staff',
      merchantId,
      serviceId,
      date,
      durationMinutes,
      stepMinutes: SLOT_STEP_MINUTES,
      timezone,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      slots,
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

  private zonedDayBoundsFromDateOnly(
    date: string,
    timeZone: string,
  ): { windowStart: Date; windowEnd: Date } {
    // Interpret the provided YYYY-MM-DD as a *local day* in the given timezone.
    // Convert local midnight to UTC instant.
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!parts) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const y = Number(parts[1]);
    const m = Number(parts[2]);
    const d = Number(parts[3]);
    const windowStart = this.zonedDateTimeToUtc({ y, m, d, hh: 0, mm: 0 }, timeZone);
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60_000);
    return { windowStart, windowEnd };
  }

  private getZonedDayOfWeek(date: Date, timeZone: string): number {
    // Return 0=Sun..6=Sat based on the timezone-local calendar day.
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    });
    const w = fmt.format(date);
    switch (w) {
      case 'Sun':
        return 0;
      case 'Mon':
        return 1;
      case 'Tue':
        return 2;
      case 'Wed':
        return 3;
      case 'Thu':
        return 4;
      case 'Fri':
        return 5;
      case 'Sat':
        return 6;
      default:
        return 0;
    }
  }

  private getZonedMinuteOfDay(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  }

  private slotWithinWorkingHours(
    slotStartUtc: Date,
    slotEndUtc: Date,
    timeZone: string,
    windows: { start: number; end: number }[],
  ): boolean {
    if (windows.length === 0) return false;
    const startMinute = this.getZonedMinuteOfDay(slotStartUtc, timeZone);
    const endMinute = this.getZonedMinuteOfDay(slotEndUtc, timeZone);
    if (!(startMinute < endMinute)) return false;
    for (const w of windows) {
      if (startMinute >= w.start && endMinute <= w.end) {
        return true;
      }
    }
    return false;
  }

  private zonedDateTimeToUtc(
    args: { y: number; m: number; d: number; hh: number; mm: number },
    timeZone: string,
  ): Date {
    // Convert a timezone-local date/time to a UTC instant using Intl offset inference.
    // Iterative approach is sufficient for midnight conversions across DST boundaries.
    const initialGuess = new Date(Date.UTC(args.y, args.m - 1, args.d, args.hh, args.mm));

    const adjust = (guess: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(guess);

      const year = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
      const month = Number(parts.find((p) => p.type === 'month')?.value ?? '1');
      const day = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
      const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

      const desiredUtc = Date.UTC(args.y, args.m - 1, args.d, args.hh, args.mm);
      const seenAsUtc = Date.UTC(year, month - 1, day, hour, minute);
      const deltaMs = desiredUtc - seenAsUtc;
      return new Date(guess.getTime() + deltaMs);
    };

    const pass1 = adjust(initialGuess);
    const pass2 = adjust(pass1);
    return pass2;
  }

  private async computeCalendar(args: {
    merchantId: string;
    serviceId: string;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<{
    merchantId: string;
    serviceId: string;
    durationMinutes: number;
    windowStart: string;
    windowEnd: string;
    slots: DayCalendarSlot[];
  }> {
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

    const slots: DayCalendarSlot[] = [];
    const stepMs = SLOT_STEP_MINUTES * 60_000;
    const windowEndMs = windowEnd.getTime();

    for (let t = windowStart.getTime(); t < windowEndMs; t += stepMs) {
      const slotStart = new Date(t);
      const slotEnd = addMinutes(slotStart, durationMinutes);
      if (slotEnd.getTime() > windowEndMs) {
        break;
      }

      const blocked = this.slotBlocked(slotStart, slotEnd, blocks);
      slots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        status: blocked ? 'BUSY' : 'FREE',
      });
    }

    return {
      merchantId,
      serviceId,
      durationMinutes,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      slots,
    };
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
      end_time?: Date | null;
      duration_minutes?: number | null;
      services: { duration_minutes: number } | null;
    }[],
  ): Block[] {
    return existing.map((appt) => {
      const d = appt.duration_minutes ?? appt.services?.duration_minutes ?? 30;
      const end = appt.end_time ?? addMinutes(appt.start_time, d);
      return {
        start: appt.start_time,
        end,
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
