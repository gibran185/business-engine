import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class SetStaffServicesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  serviceIds!: string[];
}

