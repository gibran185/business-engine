import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { GeopositionOnboardingDto } from './create-merchant-onboarding.dto.js';

/** Partial legal representative for PATCH onboarding. */
export class UpdateLegalRepresentativeOnboardingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;
}

/** Partial headquarters for PATCH onboarding. */
export class UpdateHeadquartersOnboardingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstLine?: string;

  @IsOptional()
  @IsString()
  secondLine?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  zipcode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  municipality?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  state?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;
}

export class UpdateMerchantOnboardingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateLegalRepresentativeOnboardingDto)
  legalRepresentative?: UpdateLegalRepresentativeOnboardingDto;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateHeadquartersOnboardingDto)
  headquarters?: UpdateHeadquartersOnboardingDto;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  businessPhone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeopositionOnboardingDto)
  geoposition?: GeopositionOnboardingDto;

  @IsOptional()
  @IsObject()
  brandingConfig?: Record<string, unknown>;
}
