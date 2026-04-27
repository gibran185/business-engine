import { IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * `date` is a merchant-local calendar day (`YYYY-MM-DD`) interpreted in the merchant timezone.
 * If `staffId` is omitted, response aggregates across eligible staff.
 */
export class StaffDayCalendarQueryDto {
  @IsUUID('4')
  merchantId!: string;

  @IsUUID('4')
  serviceId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD (merchant local calendar day)',
  })
  date!: string;

  @IsOptional()
  @IsUUID('4')
  staffId?: string;
}

