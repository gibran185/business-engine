import { IsUUID, Matches } from 'class-validator';

/** `date` is a UTC calendar day (`YYYY-MM-DD`), i.e. `[00:00, next day 00:00) in UTC`. */
export class AvailableSlotsQueryDto {
  @IsUUID('4')
  merchantId!: string;

  @IsUUID('4')
  serviceId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD (UTC calendar day)',
  })
  date!: string;
}
