import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../../auth/types/jwt-user.types.js';
import { AvailabilityService } from './availability.service.js';
import { AppointmentsService } from './appointments.service.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppointmentsController.name);
  }

  /** Public: client sends merchant + service + time window (e.g. local day as ISO instants). */
  @Get('availability')
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.availabilityService.getAvailability(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    this.logger.info(
      {
        customerId: user.userId,
        merchantId: dto.merchantId,
        serviceId: dto.serviceId,
        startTime: dto.startTime,
      },
      'createAppointment: request accepted',
    );
    const appointment = await this.appointmentsService.create(dto, user.userId);
    this.logger.info(
      { appointmentId: appointment.id, status: appointment.status },
      'createAppointment: persisted',
    );
    return appointment;
  }
}
