export const MERCHANT_CUSTOMER_STATUSES = [
  'active',
  'unsubscribed',
  'blocked',
] as const;

export type MerchantCustomerStatus = (typeof MERCHANT_CUSTOMER_STATUSES)[number];
