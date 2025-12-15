import { Controller, Get } from '@nestjs/common';
import { CourierService } from './courier.service';

@Controller('/couriers')
export class CourierController {
  constructor(private readonly courierService: CourierService) {}

  @Get()
  getCouriers() {
    return this.courierService.getAllProviders();
  }
}
