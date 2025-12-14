import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsNotEmpty() address: string;
  @IsString() @IsNotEmpty() city: string;
  @IsString() @IsNotEmpty() countryCode: string;
}

class DimensionsDto {
  @IsNumber() @IsNotEmpty() weight: number;
  @IsNumber() @IsOptional() length?: number;
  @IsNumber() @IsOptional() width?: number;
  @IsNumber() @IsOptional() height?: number;
}

export class CreateWaybillReqDto {
  @IsString()
  @IsNotEmpty()
  orderReference: string;

  @ValidateNested()
  @Type(() => AddressDto)
  sender: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  receiver: AddressDto;

  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions: DimensionsDto;
}
