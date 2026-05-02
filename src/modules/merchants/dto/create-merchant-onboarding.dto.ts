import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class LegalRepresentativeOnboardingDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;
}

export class HeadquartersOnboardingDto {
  @IsString()
  @IsNotEmpty()
  firstLine!: string;

  @IsOptional()
  @IsString()
  secondLine?: string;

  @IsString()
  @IsNotEmpty()
  zipcode!: string;

  @IsString()
  @IsNotEmpty()
  municipality!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;
}

export class GeopositionOnboardingDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  long!: number;
}

export class CreateMerchantOnboardingDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @ValidateNested()
  @Type(() => LegalRepresentativeOnboardingDto)
  legalRepresentative!: LegalRepresentativeOnboardingDto;

  @IsOptional()
  @IsString()
  taxId?: string;

  @ValidateNested()
  @Type(() => HeadquartersOnboardingDto)
  headquarters!: HeadquartersOnboardingDto;

  @IsString()
  @IsNotEmpty()
  businessPhone!: string;

  @ValidateNested()
  @Type(() => GeopositionOnboardingDto)
  geoposition!: GeopositionOnboardingDto;
}
