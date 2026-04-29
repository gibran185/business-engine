import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateCustomerProfileDto {
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
