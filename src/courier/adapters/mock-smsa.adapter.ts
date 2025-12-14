import { Injectable, Logger } from '@nestjs/common';
import { ICourierAdapter } from '../interface/courier.interface';
import { ShipmentStatus } from 'src/generated/prisma/enums';
import {
  CreateWaybillReqDto,
  CreateWaybillResDto,
  TrackingResDto,
} from '../dto';

@Injectable()
export class MockSmsaAdapter implements ICourierAdapter {
  private readonly logger = new Logger(MockSmsaAdapter.name);

  // 1. Unique ID for this provider
  readonly providerId = 'mockSmsa';

  // 2. Define what this adapter supports
  readonly capabilities = {
    cancellation: true, // SMSA supports cancellation
    printLabel: true,
  };

  /**
   * Status Mapping: This is where we translate "SMSA Language" to "ZidShip Language"
   *
   */
  mapStatus(rawStatus: string): ShipmentStatus {
    const normalized = rawStatus.toUpperCase().trim();
    switch (normalized) {
      case 'DATA_RECEIVED':
        return ShipmentStatus.CREATED;
      case 'WITH_COURIER':
        return ShipmentStatus.PICKED_UP;
      case 'OUT_FOR_DELIVERY':
        return ShipmentStatus.OUT_FOR_DELIVERY;
      case 'DELIVERED_TO_CUSTOMER':
        return ShipmentStatus.DELIVERED;
      case 'CANCELED':
        return ShipmentStatus.CANCELLED;
      default:
        return ShipmentStatus.PENDING;
    }
  }

  /**
   * Core: Create Waybill
   * Simulates an HTTP POST to SMSA API
   */
  async createWaybill(
    input: CreateWaybillReqDto,
  ): Promise<CreateWaybillResDto> {
    this.logger.log(`Creating waybill for Order ${input.orderReference}...`);

    // Simulate API Latency (e.g., 500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Fake Response from "External API"
    const fakeTrackingNumber = '2900' + Math.floor(Math.random() * 10000000);
    const fakeReference = 'SMSA-REF-' + Math.floor(Math.random() * 1000);

    return {
      trackingNumber: fakeTrackingNumber,
      courierRef: fakeReference,
      labelUrl: `https://track.smsa.sa/print/${fakeTrackingNumber}`,
      rawResponse: {
        // We always store the raw response for debugging
        status: 'success',
        message: 'Waybill created successfully',
        awb: fakeTrackingNumber,
        ref_id: fakeReference,
      },
    };
  }

  /**
   * Core: Track Shipment
   * Returns a history of events mapped to our Unified Enum
   */
  async trackShipment(trackingNumber: string): Promise<TrackingResDto> {
    this.logger.log(`Tracking shipment ${trackingNumber}...`);

    // Simulate API Latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock Raw Data from SMSA
    const rawEvents = [
      {
        status: 'DATA_RECEIVED',
        time: '2023-10-01T10:00:00Z',
        location: 'Riyadh Hub',
      },
      {
        status: 'WITH_COURIER',
        time: '2023-10-01T14:00:00Z',
        location: 'Riyadh Hub',
      },
      {
        status: 'OUT_FOR_DELIVERY',
        time: '2023-10-02T09:00:00Z',
        location: 'Jeddah',
      },
    ];

    // Map to Unified Format
    const history = rawEvents.map((event) => ({
      status: this.mapStatus(event.status), // <--- The Magic Happens Here
      rawStatus: event.status,
      description: `Status changed to ${event.status} at ${event.location}`,
      eventDate: new Date(event.time),
    }));

    return {
      trackingNumber,
      currentStatus: history[history.length - 1].status,
      events: history,
    };
  }

  /**
   * Core: Get Label
   * Simulates returning a PDF buffer
   */
  async getLabel(trackingNumber: string): Promise<Buffer | string> {
    // Return a dummy string for now, but in real life, you'd fetch a PDF stream
    return `https://demo.smsa.com/labels/${trackingNumber}.pdf`;
  }

  /**
   * Optional: Cancel Shipment
   */
  async cancelShipment(trackingNumber: string): Promise<boolean> {
    this.logger.log(`Cancelling shipment ${trackingNumber}`);
    setTimeout(() => {}, 200); // Simulate latency
    return true; // Simulate success
  }
}
