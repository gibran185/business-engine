import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CustomerOnboardingDto {
  @IsUUID('4')
  merchantId!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
