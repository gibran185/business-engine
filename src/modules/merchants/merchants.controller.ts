import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  Get,
  Put,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { StaffMerchantParam } from '../../tenancy/decorators/staff-merchant-param.decorator.js';
import { MerchantAdminGuard } from '../../tenancy/merchant-admin.guard.js';
import { CreateMerchantStaffDto } from './dto/create-merchant-staff.dto.js';
import { SetStaffServicesDto } from './dto/set-staff-services.dto.js';
import { SetStaffWorkingHoursDto } from './dto/set-staff-working-hours.dto.js';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('config/:slug')
  async getConfigBySlug(@Param('slug') slug: string) {
    return this.merchantsService.getConfigBySlug(slug);
  }

  @Post(':merchantId/staff')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async createMerchantStaff(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: CreateMerchantStaffDto,
  ) {
    return this.merchantsService.createMerchantStaff(merchantId, dto);
  }

  @Get(':merchantId/staff')
  @UseGuards(JwtAuthGuard)
  @StaffMerchantParam('merchantId')
  async listMerchantStaff(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
  ) {
    return this.merchantsService.listMerchantStaff(merchantId);
  }

  @Get(':merchantId/staff/:staffId')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async getStaffDetail(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
  ) {
    return this.merchantsService.getMerchantStaffDetail(merchantId, staffId);
  }

  @Put(':merchantId/staff/:staffId/services')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async setStaffServices(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
    @Body() dto: SetStaffServicesDto,
  ) {
    return this.merchantsService.setStaffServices(merchantId, staffId, dto);
  }

  @Put(':merchantId/staff/:staffId/working-hours')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async setStaffWorkingHours(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
    @Body() dto: SetStaffWorkingHoursDto,
  ) {
    return this.merchantsService.setStaffWorkingHours(merchantId, staffId, dto);
  }
}
