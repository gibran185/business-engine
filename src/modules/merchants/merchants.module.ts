import { Module } from '@nestjs/common';
import { MerchantsService } from './merchants.service.js';
import { MerchantsController } from './merchants.controller.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { StorageModule } from '../../storage/storage.module.js';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
})
export class MerchantsModule {}
