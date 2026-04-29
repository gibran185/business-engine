import { IsIn } from 'class-validator';

export class UpdateMerchantCustomerStatusDto {
  @IsIn(['active', 'blocked'])
  status!: 'active' | 'blocked';
}
