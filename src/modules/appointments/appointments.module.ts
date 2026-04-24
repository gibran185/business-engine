import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AppointmentsController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AvailabilityService],
})
export class AppointmentsModule {}
