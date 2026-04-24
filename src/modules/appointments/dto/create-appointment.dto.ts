import { IsISO8601, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID('4')
  merchantId!: string;

  @IsUUID('4')
  serviceId!: string;

  @IsISO8601()
  startTime!: string;
}
