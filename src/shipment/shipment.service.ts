// src/shipment/shipment.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourierService } from 'src/courier/courier.service';
import { ShipmentStatus } from 'src/generated/prisma/enums';
import { CreateWaybillReqDto } from 'src/courier/dto/create-waybill.req.dto';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courierService: CourierService,
  ) {}

  /**
   * Orchestrate the entire creation flow:
   * 1. Validate Adapter -> 2. Save DB (Pending) -> 3. Call API -> 4. Update DB
   */
  async createShipment(courierId: string, data: CreateWaybillReqDto) {
    // Step 1: Logic Check
    const adapter = this.courierService.getAdapter(courierId);

    // Step 2: Database Transaction (Start PENDING)
    const shipment = await this.prisma.shipment.create({
      data: {
        courierId,
        orderReference: data.orderReference,
        senderDetails: data.sender as any,
        receiverDetails: data.receiver as any,
        dimensions: data.dimensions as any,
        status: ShipmentStatus.PENDING,
      },
    });

    try {
      // Step 3: External API Call
      const result = await adapter.createWaybill(data);

      // Step 4: Success Update
      return await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.CREATED,
          trackingNumber: result.trackingNumber,
          courierRef: result.courierRef,
          labelUrl: result.labelUrl,
        },
      });
    } catch (error) {
      // Step 5: Failure Recovery
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: ShipmentStatus.FAILED },
      });
      // Re-throw a clean HTTP exception
      throw new BadRequestException(`Courier failed: ${error.message}`);
    }
  }

  async trackShipment(trackingNumber: string) {
    // 1. Find the shipment to know which courier controls it
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    // 2. Load the correct adapter
    const adapter = this.courierService.getAdapter(shipment.courierId);

    // 3. Get live status
    const trackingResult = await adapter.trackShipment(trackingNumber);

    // 4. (Optional) Sync latest status to DB
    if (shipment.status !== trackingResult.currentStatus) {
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: trackingResult.currentStatus },
      });
    }

    return trackingResult;
  }

  async getLabel(trackingNumber: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    const adapter = this.courierService.getAdapter(shipment.courierId);

    // Logic Check: Does this courier even support printing?
    if (!adapter.capabilities.printLabel) {
      throw new UnprocessableEntityException(
        'This courier does not support label printing via API',
      );
    }

    const result = await adapter.getLabel(trackingNumber);

    // Return a standardized object so Controller doesn't need to guess
    if (Buffer.isBuffer(result)) {
      return { file: result, url: null };
    } else {
      return { file: null, url: result };
    }
  }
  async cancelShipment(trackingNumber: string) {
    // 1. Find the shipment
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
    });

    if (!shipment) throw new NotFoundException('Shipment not found');

    // 2. Prevent cancelling if already delivered
    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel a delivered shipment');
    }

    // 3. Get the adapter
    const adapter = this.courierService.getAdapter(shipment.courierId);

    // 4. Check Capability (The "Optional" Constraint)
    if (!adapter.capabilities.cancellation || !adapter.cancelShipment) {
      throw new UnprocessableEntityException(
        `Cancellation is not supported by courier: ${shipment.courierId}`,
      );
    }

    try {
      // 5. Call External API
      const success = await adapter.cancelShipment(trackingNumber);

      if (success) {
        // 6. Update DB
        return await this.prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: ShipmentStatus.CANCELLED },
        });
      } else {
        throw new Error('Courier refused cancellation');
      }
    } catch (error) {
      throw new BadRequestException(`Cancellation failed: ${error.message}`);
    }
  }
}
