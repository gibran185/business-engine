import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MerchantAccessService } from './merchant-access.service.js';
import { MerchantStaffGuard } from './merchant-staff.guard.js';
import { STAFF_MERCHANT_PARAM_METADATA } from './tenancy.constants.js';

function mockContext(overrides: {
  user?: { userId: string; email?: string };
  params?: Record<string, string>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: overrides.user, params: overrides.params ?? {} }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('MerchantStaffGuard', () => {
  let guard: MerchantStaffGuard;
  let access: { isUserStaffOfMerchant: ReturnType<typeof jest.fn> };
  let reflector: { getAllAndOverride: ReturnType<typeof jest.fn> };

  beforeEach(() => {
    access = { isUserStaffOfMerchant: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new MerchantStaffGuard(
      reflector as unknown as Reflector,
      access as unknown as MerchantAccessService,
    );
  });

  it('throws if handler is missing @StaffMerchantParam metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(
      guard.canActivate(
        mockContext({ user: { userId: 'a' }, params: { merchantId: 'b' } }),
      ),
    ).rejects.toThrow();
  });

  it('throws Forbidden when not staff', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) =>
        key === STAFF_MERCHANT_PARAM_METADATA ? 'merchantId' : undefined,
    );
    access.isUserStaffOfMerchant.mockResolvedValue(false);
    await expect(
      guard.canActivate(
        mockContext({
          user: { userId: '33333333-3333-3333-3333-333333333333' },
          params: { merchantId: '11111111-1111-1111-1111-111111111111' },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows when staff', async () => {
    reflector.getAllAndOverride.mockImplementation(
      (key: string) =>
        key === STAFF_MERCHANT_PARAM_METADATA ? 'merchantId' : undefined,
    );
    access.isUserStaffOfMerchant.mockResolvedValue(true);
    await expect(
      guard.canActivate(
        mockContext({
          user: { userId: '33333333-3333-3333-3333-333333333333' },
          params: { merchantId: '11111111-1111-1111-1111-111111111111' },
        }),
      ),
    ).resolves.toBe(true);
  });
});
