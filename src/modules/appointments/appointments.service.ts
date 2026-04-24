import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CANCELLED_APPOINTMENT_STATUSES,
  MAX_SERVICE_DURATION_MINUTES,
} from './appointments.constants.js';
import type { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { addMinutes, intervalsOverlapHalfOpen } from './time-interval.util.js';

type BlockingAppointment = {
  start_time: Date;
  services: { duration_minutes: number } | null;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppointmentsService.name);
  }

  async create(dto: CreateAppointmentDto, customerId: string) {
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

    const service = await this.prisma.services.findFirst({
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

    const blocking = await this.loadBlockingAppointments(
      dto.merchantId,
      startTime,
      slotEnd,
    );

    this.logger.info(
      { blockingCount: blocking.length, merchantId: dto.merchantId },
      'create: loaded overlapping appointments for conflict check',
    );

    if (this.slotConflicts(startTime, slotEnd, blocking)) {
      this.logger.warn(
        {
          merchantId: dto.merchantId,
          slotStart: startTime.toISOString(),
          slotEnd: slotEnd.toISOString(),
        },
        'create: slot conflict — rejecting',
      );
      throw new ConflictException('That time slot is not available');
    }

    this.logger.info(
      { merchantId: dto.merchantId, customerId },
      'create: no conflict, inserting appointment',
    );

    return this.prisma.appointments.create({
      data: {
        merchant_id: dto.merchantId,
        service_id: dto.serviceId,
        customer_id: customerId,
        start_time: startTime,
        status: 'pending',
      },
      select: {
        id: true,
        merchant_id: true,
        service_id: true,
        customer_id: true,
        start_time: true,
        status: true,
        created_at: true,
      },
    });
  }

  private async loadBlockingAppointments(
    merchantId: string,
    slotStart: Date,
    slotEnd: Date,
  ): Promise<BlockingAppointment[]> {
    const windowStart = addMinutes(slotStart, -MAX_SERVICE_DURATION_MINUTES);
    return this.prisma.appointments.findMany({
      where: {
        merchant_id: merchantId,
        status: { notIn: [...CANCELLED_APPOINTMENT_STATUSES] },
        start_time: {
          gte: windowStart,
          lt: slotEnd,
        },
      },
      select: {
        start_time: true,
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
      const duration = appt.services?.duration_minutes ?? 30;
      const apptEnd = addMinutes(appt.start_time, duration);
      if (
        intervalsOverlapHalfOpen(slotStart, slotEnd, appt.start_time, apptEnd)
      ) {
        return true;
      }
    }
    return false;
  }
}
