import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../../auth/types/jwt-user.types.js';
import { CustomersService } from './customers.service.js';
import { AssociateMerchantDto } from './dto/associate-merchant.dto.js';
import { CustomerOnboardingDto } from './dto/customer-onboarding.dto.js';
import { UnsubscribeMerchantDto } from './dto/unsubscribe-merchant.dto.js';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto.js';

@Controller('customers/me')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post('onboarding')
  async onboarding(@CurrentUser() user: JwtUser, @Body() dto: CustomerOnboardingDto) {
    return this.customersService.onboarding(user.userId, user.email, dto);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customersService.updateProfile(user.userId, user.email, dto);
  }

  @Post('merchants')
  async associateMerchant(
    @CurrentUser() user: JwtUser,
    @Body() dto: AssociateMerchantDto,
  ) {
    return this.customersService.associateMerchant(user.userId, user.email, dto);
  }

  @Get('merchants')
  async listCustomerMerchants(@CurrentUser() user: JwtUser) {
    return this.customersService.listCustomerMerchants(user.userId);
  }

  @Patch('merchants/:merchantId')
  async unsubscribeMerchant(
    @CurrentUser() user: JwtUser,
    @Param('merchantId', new ParseUUIDPipe()) merchantId: string,
    @Body() dto: UnsubscribeMerchantDto,
  ) {
    const { status } = dto;
    void status;
    return this.customersService.unsubscribeMerchant(user.userId, merchantId);
  }
}
