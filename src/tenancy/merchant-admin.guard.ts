import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtUser } from '../auth/types/jwt-user.types.js';
import { MerchantAccessService } from './merchant-access.service.js';
import { MerchantStaffRole } from './merchant-staff-role.enum.js';
import { STAFF_MERCHANT_PARAM_METADATA } from './tenancy.constants.js';

@Injectable()
export class MerchantAdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly merchantAccess: MerchantAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(
      STAFF_MERCHANT_PARAM_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (paramName === undefined) {
      throw new Error(
        'MerchantAdminGuard must be used together with @StaffMerchantParam()',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtUser | undefined;
    if (!user?.userId) {
      throw new UnauthorizedException();
    }

    const raw = request.params?.[paramName];
    const merchantId = Array.isArray(raw) ? raw[0] : raw;
    if (merchantId === undefined || merchantId === '') {
      throw new NotFoundException('Merchant not specified');
    }

    const role = await this.merchantAccess.getUserStaffRole(
      user.userId,
      merchantId,
    );

    if (role !== MerchantStaffRole.ADMIN && role !== MerchantStaffRole.SUPERVISOR) {
      throw new ForbiddenException(
        'Only merchant admins or supervisors can manage staff',
      );
    }

    return true;
  }
}

