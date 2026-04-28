import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MerchantAccessService } from '../../tenancy/merchant-access.service.js';
import { MerchantAdminGuard } from '../../tenancy/merchant-admin.guard.js';
import { MerchantStaffGuard } from '../../tenancy/merchant-staff.guard.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [
        ServicesService,
        MerchantAccessService,
        MerchantAdminGuard,
        MerchantStaffGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: {
            merchants: { findUnique: jest.fn() },
            services: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            appointments: { count: jest.fn() },
            $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
              fn({
                staff_services: { deleteMany: jest.fn() },
                services: { delete: jest.fn() },
              }),
            ),
          },
        },
      ],
    }).compile();

    controller = module.get<ServicesController>(ServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
