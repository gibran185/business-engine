import { Equals } from 'class-validator';

export class UnsubscribeMerchantDto {
  @Equals('unsubscribed')
  status!: 'unsubscribed';
}
