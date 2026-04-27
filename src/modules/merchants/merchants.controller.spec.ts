import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsController } from './merchants.controller.js';
import { MerchantsService } from './merchants.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantAccessService } from '../../tenancy/merchant-access.service.js';
import { MerchantAdminGuard } from '../../tenancy/merchant-admin.guard.js';

describe('MerchantsController', () => {
  let controller: MerchantsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantsController],
      providers: [
        MerchantsService,
        MerchantAccessService,
        MerchantAdminGuard,
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
});
