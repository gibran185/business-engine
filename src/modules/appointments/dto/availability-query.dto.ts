import { IsISO8601, IsUUID } from 'class-validator';

export class AvailabilityQueryDto {
  @IsUUID('4')
  merchantId!: string;

  @IsUUID('4')
  serviceId!: string;

  @IsISO8601()
  windowStart!: string;

  @IsISO8601()
  windowEnd!: string;
}
