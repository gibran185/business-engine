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
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { StaffMerchantParam } from '../../tenancy/decorators/staff-merchant-param.decorator.js';
import { MerchantAdminGuard } from '../../tenancy/merchant-admin.guard.js';
import { MerchantStaffGuard } from '../../tenancy/merchant-staff.guard.js';
import { CreateMerchantStaffDto } from './dto/create-merchant-staff.dto.js';
import { SetStaffServicesDto } from './dto/set-staff-services.dto.js';
import { SetStaffWorkingHoursDto } from './dto/set-staff-working-hours.dto.js';
import { UpdateMerchantCustomerStatusDto } from './dto/update-merchant-customer-status.dto.js';
import { UpdateMerchantStaffDto } from './dto/update-merchant-staff.dto.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../../auth/types/jwt-user.types.js';
import { CreateMerchantOnboardingDto } from './dto/create-merchant-onboarding.dto.js';
import { UpdateMerchantOnboardingDto } from './dto/update-merchant-onboarding.dto.js';

@ApiTags('Merchants')
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('config/:slug')
  async getConfigBySlug(@Param('slug') slug: string) {
    return this.merchantsService.getConfigBySlug(slug);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async listMyMerchants(@CurrentUser() user: JwtUser) {
    return this.merchantsService.listMyMerchants(user.userId);
  }

  @Post('onboarding')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async onboarding(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMerchantOnboardingDto,
  ) {
    return this.merchantsService.onboarding(user, dto);
  }

  @Patch(':merchantId/onboarding')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async updateMerchantOnboarding(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: UpdateMerchantOnboardingDto,
  ) {
    return this.merchantsService.updateMerchantOnboarding(merchantId, dto);
  }

  @Get(':merchantId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantStaffGuard)
  @StaffMerchantParam('merchantId')
  async getMerchantById(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
  ) {
    return this.merchantsService.getMerchantById(merchantId);
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
  @UseGuards(JwtAuthGuard, MerchantStaffGuard)
  @StaffMerchantParam('merchantId')
  async listMerchantStaff(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
  ) {
    return this.merchantsService.listMerchantStaff(merchantId);
  }

  @Get(':merchantId/customers')
  @UseGuards(JwtAuthGuard, MerchantStaffGuard)
  @StaffMerchantParam('merchantId')
  async listMerchantCustomers(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.merchantsService.listMerchantCustomers(merchantId, user.userId);
  }

  @Patch(':merchantId/customers/:customerId/status')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async updateMerchantCustomerStatus(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('customerId', new ParseUUIDPipe()) customerId: string,
    @Body() dto: UpdateMerchantCustomerStatusDto,
  ) {
    return this.merchantsService.updateMerchantCustomerStatus(
      merchantId,
      customerId,
      dto.status,
    );
  }

  @Get(':merchantId/staff/:staffId')
  @UseGuards(JwtAuthGuard, MerchantStaffGuard)
  @StaffMerchantParam('merchantId')
  async getStaffDetail(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
  ) {
    return this.merchantsService.getMerchantStaffDetail(merchantId, staffId);
  }

  @Patch(':merchantId/staff/:staffId')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  updateMerchantStaff(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
    @Body() dto: UpdateMerchantStaffDto,
  ) {
    return this.merchantsService.updateMerchantStaff(merchantId, staffId, dto);
  }

  @Delete(':merchantId/staff/:staffId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async removeMerchantStaff(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Param('staffId', new ParseUUIDPipe()) staffId: string,
  ) {
    await this.merchantsService.removeMerchantStaff(merchantId, staffId);
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

  @Put(':merchantId/logo')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.merchantsService.uploadLogo(merchantId, file);
  }

  @Delete(':merchantId/logo')
  @HttpCode(204)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, MerchantAdminGuard)
  @StaffMerchantParam('merchantId')
  async deleteLogo(
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
  ) {
    await this.merchantsService.deleteLogo(merchantId);
  }
}
