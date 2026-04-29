import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomerRelationsService } from './customer-relations.service.js';
import { CustomersService } from './customers.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerRelationsService],
  exports: [CustomerRelationsService],
})
export class CustomersModule {}
