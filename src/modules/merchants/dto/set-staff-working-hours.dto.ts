import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StaffWorkingHoursRowDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(24 * 60)
  startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(24 * 60)
  endMinute!: number;

  @IsBoolean()
  isActive!: boolean;
}

export class SetStaffWorkingHoursDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StaffWorkingHoursRowDto)
  rows!: StaffWorkingHoursRowDto[];
}

