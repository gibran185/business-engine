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
import { MerchantAccessService } from './merchant-access.service.js';
import { STAFF_MERCHANT_PARAM_METADATA } from './tenancy.constants.js';
import type { JwtUser } from '../auth/types/jwt-user.types.js';

@Injectable()
export class MerchantStaffGuard implements CanActivate {
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
        'MerchantStaffGuard must be used together with @StaffMerchantParam()',
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

    const allowed = await this.merchantAccess.isUserStaffOfMerchant(
      user.userId,
      merchantId,
    );

    if (!allowed) {
      throw new ForbiddenException(
        'You do not have access to manage this business',
      );
    }

    return true;
  }
}
