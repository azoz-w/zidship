import { Module } from '@nestjs/common';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { MockSmsaAdapter } from './adapters/mock-smsa.adapter';
import { SmsaAdapter } from './adapters/smsa.adapter';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [CourierController],
  providers: [
    CourierService,
    MockSmsaAdapter,
    SmsaAdapter,
    {
      // 2. Create the provider array that CourierService injects
      provide: 'COURIER_ADAPTERS',
      useFactory: (mockSmsa: MockSmsaAdapter, smsa: SmsaAdapter) => {
        return [smsa, mockSmsa];
      },
      inject: [MockSmsaAdapter, SmsaAdapter],
    },
  ],
  exports: [CourierService],
})
export class CourierModule {}
