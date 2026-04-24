import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto, customerId: string) {
    const startTime = new Date(dto.startTime);

    const service = await this.prisma.services.findFirst({
      where: {
        id: dto.serviceId,
        merchant_id: dto.merchantId,
        is_active: true,
      },
    });

    if (!service?.merchant_id) {
      throw new NotFoundException('Service not found for this merchant');
    }

    const slotEnd = addMinutes(startTime, service.duration_minutes);
    const blocking = await this.loadBlockingAppointments(
      dto.merchantId,
      startTime,
      slotEnd,
    );

    if (this.slotConflicts(startTime, slotEnd, blocking)) {
      throw new ConflictException('That time slot is not available');
    }

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
