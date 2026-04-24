import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  ) {}

  /** Public: client sends merchant + service + time window (e.g. local day as ISO instants). */
  @Get('availability')
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.availabilityService.getAvailability(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.appointmentsService.create(dto, user.userId);
  }
}
