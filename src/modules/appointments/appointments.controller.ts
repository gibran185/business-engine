import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../../auth/types/jwt-user.types.js';
import { AvailabilityService } from './availability.service.js';
import { AppointmentsService } from './appointments.service.js';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { StaffDayCalendarQueryDto } from './dto/staff-day-calendar-query.dto.js';

@Controller()
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppointmentsController.name);
  }

  /** Public: client sends merchant + service + time window (e.g. local day as ISO instants). */
  @Get('appointments/availability')
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.availabilityService.getAvailability(query);
  }

  /**
   * Hot path: full UTC day for the given `date=YYYY-MM-DD` (see AvailabilityService).
   * Backed by the same slot engine; DB uses index on `(merchant_id, start_time)`.
   */
  @Get('appointments/available-slots')
  getAvailableSlots(@Query() query: AvailableSlotsQueryDto) {
    return this.availabilityService.getAvailableSlotsForDate(
      query.merchantId,
      query.serviceId,
      query.date,
    );
  }

  /**
   * Public: returns a day "calendar" with FREE/BUSY slots in UTC so clients can
   * render a grid and only allow selection of FREE slots.
   */
  @Get('appointments/day-calendar')
  getDayCalendar(@Query() query: AvailableSlotsQueryDto) {
    return this.availabilityService.getDayCalendarForDate(
      query.merchantId,
      query.serviceId,
      query.date,
    );
  }

  @Get('appointments/staff-day-calendar')
  getStaffDayCalendar(@Query() query: StaffDayCalendarQueryDto) {
    return this.availabilityService.getStaffDayCalendarForDate({
      merchantId: query.merchantId,
      serviceId: query.serviceId,
      date: query.date,
      staffId: query.staffId,
    });
  }

  /**
   * Customer books with the authenticated user as `customer_id`. The merchant
   * id comes from the path, not the JSON body, so it is not client-controlled
   * in two places. For staff-only actions, add `MerchantStaffGuard` and
   * `@StaffMerchantParam()`.
   */
  @Post('merchants/:merchantId/appointments')
  @UseGuards(JwtAuthGuard)
  async create(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    this.logger.info(
      {
        customerId: user.userId,
        merchantId,
        serviceId: dto.serviceId,
        startTime: dto.startTime,
      },
      'createAppointment: request accepted',
    );
    const appointment = await this.appointmentsService.create(
      { ...dto, merchantId },
      user.userId,
    );
    this.logger.info(
      { appointmentId: appointment.id, status: appointment.status },
      'createAppointment: persisted',
    );
    return appointment;
  }
}
