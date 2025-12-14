import { Module } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { ShipmentController } from './shipment.controller';
import { CourierModule } from 'src/courier/courier.module';
@Module({
  providers: [ShipmentService],
  controllers: [ShipmentController],
  imports: [CourierModule],
})
export class ShipmentModule {}
