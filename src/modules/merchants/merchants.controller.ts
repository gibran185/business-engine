import { Controller, Get, Param } from '@nestjs/common';
import { MerchantsService } from './merchants.service.js';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('config/:slug')
  async getConfigBySlug(@Param('slug') slug: string) {
    return this.merchantsService.getConfigBySlug(slug);
  }
}
