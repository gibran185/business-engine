import { IsUUID } from 'class-validator';

export class AssociateMerchantDto {
  @IsUUID('4')
  merchantId!: string;
}
