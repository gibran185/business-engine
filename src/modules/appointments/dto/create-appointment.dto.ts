import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

/** Body for `POST /merchants/:merchantId/appointments` (merchant is not trusted from the body). */
export class CreateAppointmentDto {
  @IsUUID('4')
  serviceId!: string;

  @IsISO8601()
  startTime!: string;

  /** Optional: pick a specific staff member; otherwise backend auto-assigns. */
  @IsOptional()
  @IsUUID('4')
  staffId?: string;
}
