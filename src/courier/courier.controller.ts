import { Controller, Get } from '@nestjs/common';
import { CourierService } from './courier.service';
import { listCouriersRes } from './dto/list-couriers.res.dto';

@Controller('/couriers')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get()
  async getCouriers(): Promise<any> {
    return this.courierService.getAllProviders();
  }
}
