import { Injectable, Logger } from '@nestjs/common';
import { ICourierAdapter } from '../interface/courier.interface';
import { ShipmentStatus } from 'src/generated/prisma/enums';
import {
  TrackingResDto,
  CreateWaybillReqDto,
  CreateWaybillResDto,
} from '../dto';
import { Retryable } from '../../common/decorators/retryable.decorator';

@Injectable()
export class AramexAdapter implements ICourierAdapter {
  private readonly logger = new Logger(AramexAdapter.name);

  readonly providerId = 'aramex';

  readonly capabilities = {
    cancellation: false,
    printLabel: true,
  };

  @Retryable({ retries: 3, delayMs: 1000 })
  async createWaybill(
    input: CreateWaybillReqDto,
  ): Promise<CreateWaybillResDto> {
    this.logger.log(
      `⚠️ [MOCK] Creating Aramex Waybill for Ref: ${input.orderReference}`,
    );

    // Simulate Network Latency
    await this.simulateLatency();

    // Generate Mock Data
    const trackingNumber =
      '3' + Math.floor(Math.random() * 10000000000).toString();
    const labelUrl = `https://www.aramex.com/content/uploads/mock_label_${trackingNumber}.pdf`;

    this.logger.log(`✅ [MOCK] Aramex Shipment Created: ${trackingNumber}`);

    return {
      trackingNumber: trackingNumber,
      courierRef: this.providerId,
      labelUrl: labelUrl,
      rawResponse: {
        HasErrors: false,
        Notifications: [],
        Shipments: [{ ID: trackingNumber, Reference1: input.orderReference }],
      },
    };
  }

  @Retryable({ retries: 3, delayMs: 200 })
  async getLabel(trackingNumber: string): Promise<string> {
    this.logger.debug(`[MOCK] Fetching label for ${trackingNumber}`);
    return `https://www.aramex.com/mock-label/${trackingNumber}.pdf`;
  }

  @Retryable({ retries: 3, delayMs: 200 })
  async trackShipment(trackingNumber: string): Promise<TrackingResDto> {
    this.logger.debug(`[MOCK] Tracking ${trackingNumber}`);
    await this.simulateLatency();

    // Mock generic Aramex status string
    const mockAramexStatus = 'Out for Delivery';

    return {
      trackingNumber,
      currentStatus: this.mapStatus(mockAramexStatus),
      events: [
        {
          rawStatus: mockAramexStatus,
          eventDate: new Date(),
          status: 'OUT_FOR_DELIVERY',
          description: 'Shipment is out for delivery',
        },
        {
          eventDate: new Date(Date.now() - 86400000), // Yesterday
          rawStatus: 'Received at Operations Facility',
          description: 'Shipment received at hub',
          status: 'IN_TRANSIT',
        },
      ],
    };
  }

  // @Retryable({ retries: 3, delayMs: 200 })
  // async cancelShipment(trackingNumber: string): Promise<boolean> {
  //   this.logger.warn(
  //     `[MOCK] Cancellation requested for ${trackingNumber}. Not supported via API.`,
  //   );
  //   return false;
  // }

  /**
   * Utility: Map Vendor Status to Your Domain Enum
   */
  mapStatus(rawStatus: string): ShipmentStatus {
    const status = rawStatus.toLowerCase();

    if (status.includes('delivered')) return ShipmentStatus.DELIVERED;
    if (status.includes('out for delivery'))
      return ShipmentStatus.OUT_FOR_DELIVERY;
    if (status.includes('returned')) return ShipmentStatus.RETURNED;
    if (status.includes('cancelled')) return ShipmentStatus.CANCELLED;
    if (status.includes('created') || status.includes('record created'))
      return ShipmentStatus.CREATED;

    // Default fallback
    return ShipmentStatus.IN_TRANSIT;
  }

  private async simulateLatency() {
    return new Promise((resolve) => setTimeout(resolve, 600));
  }
}
