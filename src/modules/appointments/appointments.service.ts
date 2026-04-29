import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CustomerRelationsService } from '../customers/customer-relations.service.js';
import {
  CANCELLED_APPOINTMENT_STATUSES,
  MAX_SERVICE_DURATION_MINUTES,
} from './appointments.constants.js';
import type { CreateAppointmentPayload } from './dto/create-appointment-payload.type.js';
import { addMinutes, intervalsOverlapHalfOpen } from './time-interval.util.js';

type BlockingAppointment = {
  start_time: Date;
  end_time: Date | null;
  duration_minutes: number | null;
  merchant_staff_id: string | null;
  services: { duration_minutes: number } | null;
};

type AppointmentWriteClient = Pick<
  PrismaService,
  '$executeRaw' | '$queryRaw' | 'appointments' | 'services' | 'merchants' | 'merchant_staff' | 'staff_services' | 'staff_working_hours' | 'customer_profiles' | 'merchant_customers'
>;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
    private readonly customerRelations: CustomerRelationsService,
  ) {
    this.logger.setContext(AppointmentsService.name);
  }

  async create(dto: CreateAppointmentPayload, customerId: string, customerEmail?: string) {
    const startTime = new Date(dto.startTime);
    this.logger.info(
      {
        customerId,
        merchantId: dto.merchantId,
        serviceId: dto.serviceId,
        startTime: startTime.toISOString(),
      },
      'create: parsed slot start',
    );

    return this.prisma.$transaction(
      async (tx) =>
        this.createInTransaction(tx, dto, customerId, customerEmail, startTime),
      { isolationLevel: 'ReadCommitted' },
    );
  }

  private async createInTransaction(
    db: AppointmentWriteClient,
    dto: CreateAppointmentPayload,
    customerId: string,
    customerEmail: string | undefined,
    startTime: Date,
  ) {
    const service = await db.services.findFirst({
      where: {
        id: dto.serviceId,
        merchant_id: dto.merchantId,
        is_active: true,
      },
    });

    if (!service?.merchant_id) {
      this.logger.warn(
        { merchantId: dto.merchantId, serviceId: dto.serviceId },
        'create: service not found or inactive for merchant',
      );
      throw new NotFoundException('Service not found for this merchant');
    }

    this.logger.info(
      {
        serviceId: service.id,
        durationMinutes: service.duration_minutes,
      },
      'create: service resolved',
    );

    const slotEnd = addMinutes(startTime, service.duration_minutes);
    this.logger.info(
      {
        slotStart: startTime.toISOString(),
        slotEnd: slotEnd.toISOString(),
      },
      'create: slot window computed',
    );

    const merchant = await db.merchants.findUnique({
      where: { id: dto.merchantId },
      select: { id: true, timezone: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    const timeZone = merchant.timezone || 'UTC';

    const eligibleStaffIds = await this.getEligibleStaffIds(
      db,
      dto.merchantId,
      dto.serviceId,
    );

    if (eligibleStaffIds.length === 0) {
      throw new ConflictException('No staff available for this service');
    }

    const candidateStaffIds = dto.staffId
      ? [dto.staffId]
      : eligibleStaffIds;

    // If explicit staff is provided, validate eligibility early.
    if (dto.staffId && !eligibleStaffIds.includes(dto.staffId)) {
      throw new ConflictException('Selected staff cannot perform this service');
    }

    for (const staffId of candidateStaffIds) {
      const lockOk = await this.tryLockStaffSlot(
        db,
        dto.merchantId,
        staffId,
      );
      if (!lockOk) continue;

      const workingOk = await this.isStaffWorkingForSlot(
        db,
        dto.merchantId,
        staffId,
        timeZone,
        startTime,
        slotEnd,
      );
      if (!workingOk) {
        if (dto.staffId) {
          throw new ConflictException('Selected staff is not working at that time');
        }
        continue;
      }

      const blocking = await this.loadBlockingAppointments(
        db,
        dto.merchantId,
        staffId,
        startTime,
        slotEnd,
      );

      if (this.slotConflicts(startTime, slotEnd, blocking)) {
        if (dto.staffId) {
          throw new ConflictException('That time slot is not available');
        }
        continue;
      }

      const appointment = await db.appointments.create({
        data: {
          merchant_id: dto.merchantId,
          service_id: dto.serviceId,
          merchant_staff_id: staffId,
          customer_id: customerId,
          start_time: startTime,
          end_time: slotEnd,
          duration_minutes: service.duration_minutes,
          status: 'pending',
        },
        select: {
          id: true,
          merchant_id: true,
          service_id: true,
          merchant_staff_id: true,
          customer_id: true,
          start_time: true,
          end_time: true,
          duration_minutes: true,
          status: true,
          created_at: true,
        },
      });

      await this.customerRelations.ensureCustomerMerchantRelation(
        {
          merchantId: dto.merchantId,
          customerId,
          customerEmail,
          observedAt: startTime,
        },
        db,
      );

      return appointment;
    }

    throw new ConflictException('No staff available for that time slot');
  }

  private async loadBlockingAppointments(
    db: AppointmentWriteClient,
    merchantId: string,
    staffId: string,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<BlockingAppointment[]> {
    const windowStart = addMinutes(slotStart, -MAX_SERVICE_DURATION_MINUTES);
    return db.appointments.findMany({
      where: {
        merchant_id: merchantId,
        status: { notIn: [...CANCELLED_APPOINTMENT_STATUSES] },
        start_time: {
          gte: windowStart,
          lt: slotEnd,
        },
        OR: [{ merchant_staff_id: null }, { merchant_staff_id: staffId }],
      },
      select: {
        start_time: true,
        end_time: true,
        duration_minutes: true,
        merchant_staff_id: true,
        services: { select: { duration_minutes: true } },
      },
    });
  }

  private slotConflicts(
    slotStart: Date,
    slotEnd: Date,
    blocking: BlockingAppointment[],
  ): boolean {
    for (const appt of blocking) {
      const duration = appt.duration_minutes ?? appt.services?.duration_minutes ?? 30;
      const apptEnd = appt.end_time ?? addMinutes(appt.start_time, duration);
      if (
        intervalsOverlapHalfOpen(slotStart, slotEnd, appt.start_time, apptEnd)
      ) {
        return true;
      }
    }
    return false;
  }

  private async getEligibleStaffIds(
    db: AppointmentWriteClient,
    merchantId: string,
    serviceId: string,
  ): Promise<string[]> {
    const rows = await db.staff_services.findMany({
      where: { merchant_id: merchantId, service_id: serviceId },
      select: { merchant_staff_id: true },
      orderBy: { created_at: 'asc' },
    });
    return rows
      .map((r) => r.merchant_staff_id)
      .filter((id): id is string => typeof id === 'string')
      .sort();
  }

  private async tryLockStaffSlot(
    db: AppointmentWriteClient,
    merchantId: string,
    staffId: string,
  ): Promise<boolean> {
    const key = `${merchantId}:${staffId}`;
    const rows = await db.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(
        hashtext('appointments:create'),
        hashtext(${key})
      ) AS locked
    `;
    return rows[0]?.locked === true;
  }

  private async isStaffWorkingForSlot(
    db: AppointmentWriteClient,
    merchantId: string,
    staffId: string,
    timeZone: string,
    slotStartUtc: Date,
    slotEndUtc: Date,
  ): Promise<boolean> {
    const dayOfWeek = this.getZonedDayOfWeek(slotStartUtc, timeZone);
    const windows = await db.staff_working_hours.findMany({
      where: {
        merchant_id: merchantId,
        merchant_staff_id: staffId,
        day_of_week: dayOfWeek,
        is_active: true,
      },
      select: { start_minute: true, end_minute: true },
      orderBy: { start_minute: 'asc' },
    });
    if (windows.length === 0) return false;

    const startMinute = this.getZonedMinuteOfDay(slotStartUtc, timeZone);
    const endMinute = this.getZonedMinuteOfDay(slotEndUtc, timeZone);
    if (!(startMinute < endMinute)) return false;

    return windows.some(
      (w) => startMinute >= w.start_minute && endMinute <= w.end_minute,
    );
  }

  private getZonedDayOfWeek(date: Date, timeZone: string): number {
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
}
