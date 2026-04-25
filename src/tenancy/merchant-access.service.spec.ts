import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { MerchantAccessService } from './merchant-access.service.js';

describe('MerchantAccessService', () => {
  let service: MerchantAccessService;
  let findFirst: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    findFirst = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantAccessService,
        { provide: PrismaService, useValue: { merchant_staff: { findFirst } } },
      ],
    }).compile();

    service = module.get(MerchantAccessService);
  });

  it('isUserStaffOfMerchant is true when a row exists', async () => {
    findFirst.mockResolvedValue({ id: 'x' });
    await expect(
      service.isUserStaffOfMerchant(
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
      ),
    ).resolves.toBe(true);
  });

  it('isUserStaffOfMerchant is false when no row', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      service.isUserStaffOfMerchant(
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
      ),
    ).resolves.toBe(false);
  });
});
