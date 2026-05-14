import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsController } from './merchants.controller.js';
import { MerchantsService } from './merchants.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantAccessService } from '../../tenancy/merchant-access.service.js';
import { MerchantAdminGuard } from '../../tenancy/merchant-admin.guard.js';
import { MerchantStaffGuard } from '../../tenancy/merchant-staff.guard.js';

describe('MerchantsController', () => {
  let controller: MerchantsController;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [
        MerchantsService,
        MerchantAccessService,
        MerchantAdminGuard,
        MerchantStaffGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: {
            merchants: { findUnique: jest.fn() },
            merchant_staff: { findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    controller = module.get<MerchantsController>(MerchantsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates updateMerchantOnboarding to MerchantsService', async () => {
    const merchantsService = module.get(MerchantsService);
    const spy = jest.spyOn(merchantsService, 'updateMerchantOnboarding').mockResolvedValue({} as never);

    await controller.updateMerchantOnboarding(
      '11111111-1111-4111-8111-111111111111',
      { businessPhone: '+15555550123' } as never,
    );

    expect(spy).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
      businessPhone: '+15555550123',
    });
    spy.mockRestore();
  });

  it('delegates onboarding to MerchantsService', async () => {
    const merchantsService = module.get(MerchantsService);
    const spy = jest
      .spyOn(merchantsService, 'onboarding')
      .mockResolvedValue({ merchant: {} as never, staff: {} as never });

    const dto = {
      businessName: 'Test Biz',
      legalRepresentative: { firstName: 'A', lastName: 'B' },
      headquarters: {
        firstLine: '1 Main',
        zipcode: '12345',
        municipality: 'Town',
        state: 'ST',
        country: 'US',
      },
      businessPhone: '+15555550123',
      geoposition: { lat: 40.7128, long: -74.006 },
    };

    await controller.onboarding({ userId: 'user-1', email: 'a@b.co' }, dto as never);

    expect(spy).toHaveBeenCalledWith(
      { userId: 'user-1', email: 'a@b.co' },
      expect.objectContaining({ businessName: 'Test Biz' }),
    );
    spy.mockRestore();
  });
});
