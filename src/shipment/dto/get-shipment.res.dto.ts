import { Expose } from 'class-transformer';

export class GetShipmentResDto {
  @Expose()
  readonly shipmentId: string;
  readonly orderReference: string;
  readonly status: string;
  readonly updatedAt: Date;
}
