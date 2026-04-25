import { SetMetadata } from '@nestjs/common';
import { STAFF_MERCHANT_PARAM_METADATA } from '../tenancy.constants.js';

/** Use with `MerchantStaffGuard` — see `src/tenancy/merchant-staff.guard.ts`. */
export const StaffMerchantParam = (paramName: string = 'merchantId') =>
  SetMetadata(STAFF_MERCHANT_PARAM_METADATA, paramName);
