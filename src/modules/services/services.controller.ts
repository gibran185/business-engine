import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { StaffMerchantParam } from '../../tenancy/decorators/staff-merchant-param.decorator.js';
import { MerchantAdminGuard } from '../../tenancy/merchant-admin.guard.js';
import { MerchantStaffGuard } from '../../tenancy/merchant-staff.guard.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { ServicesService } from './services.service.js';

@Controller('merchants/:merchantId/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  create(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(merchantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, MerchantStaffGuard)
  @StaffMerchantParam('merchantId')
  findAll(@Param('merchantId', new ParseUUIDPipe()) merchantId: string) {
    return this.servicesService.findAll(merchantId);
  }

  @Get(':serviceId')
  @UseGuards(JwtAuthGuard, MerchantStaffGuard)
  @StaffMerchantParam('merchantId')
  findOne(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ) {
    return this.servicesService.findOne(merchantId, serviceId);
  }

  @Patch(':serviceId')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  update(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(merchantId, serviceId, dto);
  }

  @Delete(':serviceId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async remove(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('serviceId', new ParseUUIDPipe()) serviceId: string,
  ) {
    await this.servicesService.remove(merchantId, serviceId);
  }
}
