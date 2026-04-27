import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { MerchantAccessService } from './merchant-access.service.js';
import { MerchantAdminGuard } from './merchant-admin.guard.js';
import { MerchantStaffGuard } from './merchant-staff.guard.js';

/** Global so any feature module can `imports: [TenancyModule]`-free use `MerchantStaffGuard`. */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [MerchantAccessService, MerchantStaffGuard, MerchantAdminGuard],
  exports: [MerchantAccessService, MerchantStaffGuard, MerchantAdminGuard],
})
export class TenancyModule {}
