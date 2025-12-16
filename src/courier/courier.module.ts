import { Module } from '@nestjs/common';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';
import { SmsaAdapter } from './adapters/smsa.adapter';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AramexAdapter } from './adapters/aramex.adapter';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [CourierController],
  providers: [
    CourierService,
    SmsaAdapter,
    AramexAdapter,
    {
      // 2. Create the provider array that CourierService injects
      provide: 'COURIER_ADAPTERS',
      useFactory: (smsa: SmsaAdapter, aramex: AramexAdapter) => {
        return [smsa, aramex];
      },
      inject: [SmsaAdapter, AramexAdapter],
    },
  ],
  exports: [CourierService],
})
export class CourierModule {}
