import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CustomerRelationsService } from './customer-relations.service.js';
import { CustomersService } from './customers.service.js';

describe('CustomersService', () => {
  let service: CustomersService;
  let relations: { upsertCustomerProfile: jest.Mock; ensureCustomerMerchantRelation: jest.Mock };
  let prisma: {
    merchant_customers: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    relations = {
      upsertCustomerProfile: jest.fn(),
      ensureCustomerMerchantRelation: jest.fn(),
    };
    prisma = {
      merchant_customers: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: CustomerRelationsService, useValue: relations },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CustomersService);
  });

  it('is idempotent on onboarding and returns profile plus relation', async () => {
    relations.upsertCustomerProfile.mockResolvedValue({ id: 'u1' });
    relations.ensureCustomerMerchantRelation.mockResolvedValue({
      id: 'rel1',
      status: 'active',
    });

    const result = await service.onboarding('u1', 'u1@example.com', {
      merchantId: 'm1',
      fullName: 'U One',
      phoneNumber: '+1',
    });

    expect(relations.upsertCustomerProfile).toHaveBeenCalled();
    expect(relations.ensureCustomerMerchantRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'm1',
        customerId: 'u1',
        customerEmail: 'u1@example.com',
      }),
    );
    expect(result.relation.status).toBe('active');
  });

  it('rejects association when customer is blocked', async () => {
    relations.ensureCustomerMerchantRelation.mockRejectedValue(
      new ForbiddenException('Customer is blocked for this merchant'),
    );

    await expect(
      service.associateMerchant('u1', 'u1@example.com', { merchantId: 'm1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates customer profile fields', async () => {
    relations.upsertCustomerProfile.mockResolvedValue({
      id: 'u1',
      full_name: 'Updated',
      phone_number: '+52',
    });

    const result = await service.updateProfile('u1', 'u1@example.com', {
      fullName: 'Updated',
      phoneNumber: '+52',
    });

    expect(relations.upsertCustomerProfile).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        fullName: 'Updated',
        phoneNumber: '+52',
      }),
    );
    expect(result.full_name).toBe('Updated');
  });
});
