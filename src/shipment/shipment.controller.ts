// src/shipment/shipment.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import express from 'express';
import { ShipmentService } from './shipment.service';
import { CreateWaybillReqDto } from 'src/courier/dto';

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  async create(@Body() body: { courierId: string; data: CreateWaybillReqDto }) {
    return this.shipmentService.createShipment(body.courierId, body.data);
  }

  @Get(':trackingNumber/track')
  async track(@Param('trackingNumber') trackingNumber: string) {
    return this.shipmentService.trackShipment(trackingNumber);
  }

  @Get(':trackingNumber/label')
  async getLabel(
    @Param('trackingNumber') trackingNumber: string,
    @Res({ passthrough: true }) res: express.Response, // Use passthrough to let Nest handle the stream
  ) {
    const { file, url } = await this.shipmentService.getLabel(trackingNumber);

    if (file) {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="label-${trackingNumber}.pdf"`,
      });
      return new StreamableFile(file);
    }

    return { url };
  }
  @Post(':trackingNumber/cancel')
  async cancel(@Param('trackingNumber') trackingNumber: string) {
    const result = await this.shipmentService.cancelShipment(trackingNumber);
    return {
      success: true,
      message: 'Shipment cancelled successfully',
      data: result,
    };
  }
}
