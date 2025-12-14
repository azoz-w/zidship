import { Expose } from 'class-transformer';

export class CreateWayBillResDto {
  @Expose({ name: 'wishlistId' })
  courierId: string;
  orderReference: string;
  description: string;
  slug: string;
  published: boolean;
  views: number;
  createdAt: Date;

  constructor({ ...data }: Partial<CreateWayBillResDto> = {}) {
    Object.assign(this, data);
  }
}
