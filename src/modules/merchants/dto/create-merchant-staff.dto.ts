import { IsEnum, IsUUID } from 'class-validator';
import { MerchantStaffRole } from '../../../tenancy/merchant-staff-role.enum.js';

export class CreateMerchantStaffDto {
  @IsUUID('4')
  userId!: string;

  @IsEnum(MerchantStaffRole)
  role!: MerchantStaffRole;
}

