import { IsString, IsNotEmpty } from 'class-validator';

export class PrintLabelReqDto {
  @IsString()
  @IsNotEmpty()
  readonly orderReference: string;
}
