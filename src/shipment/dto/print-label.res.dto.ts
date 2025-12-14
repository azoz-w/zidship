import { Expose } from 'class-transformer';

export class PrintLabelResDto {
  @Expose()
  readonly LabelId: string;
  @Expose()
  readonly LabelType: string;
}
