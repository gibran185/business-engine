import { IsEnum } from 'class-validator';
import { MerchantStaffRole } from '../../../tenancy/merchant-staff-role.enum.js';

export class UpdateMerchantStaffDto {
  @IsEnum(MerchantStaffRole)
  role!: MerchantStaffRole;
}
