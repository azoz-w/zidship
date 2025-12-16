import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ICourierAdapter } from '../interface/courier.interface';
import { ShipmentStatus } from 'src/generated/prisma/enums';
import {
  CreateWaybillReqDto,
  CreateWaybillResDto,
  TrackingResDto,
} from '../dto';
import { Retryable } from 'src/common/decorators/retryable.decorator';

@Injectable()
export class SmsaAdapter implements ICourierAdapter {
  private readonly logger = new Logger(SmsaAdapter.name);

  // Unique ID for this provider
  readonly providerId = 'smsa';

  // adapter supports
  readonly capabilities = {
    cancellation: true,
    printLabel: true,
  };

  constructor(private readonly httpService: HttpService) {}

  /**
   * Status Mapping: This is where we translate "SMSA Language" to "ZidShip Language"
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
   * Uses httpbin.org to simulate a POST request to an external API.
   */
  @Retryable({ retries: 3, delayMs: 200 })
  async createWaybill(
    input: CreateWaybillReqDto,
  ): Promise<CreateWaybillResDto> {
    this.logger.log(`Creating waybill for Order ${input.orderReference}...`);

    // Simulate API call to SMSA (via httpbin)
    // httpbin/post echoes back the data we sent, confirming the network call worked.
    const response = await this.httpService.axiosRef.post<any>(
      'https://httpbin.org/post',
      {
        ...input,
        provider: 'SMSA',
      },
    );

    // In a real integration, we would parse response.data (or response.json)
    // to extract the tracking number. Since httpbin just echoes, we generate one.
    const fakeTrackingNumber = 'SMSA' + Math.floor(Math.random() * 10000000);
    const fakeReference = 'REF-' + Math.floor(Math.random() * 1000);

    return {
      trackingNumber: fakeTrackingNumber,
      courierRef: fakeReference,
      labelUrl: `https://track.smsa.sa/print/${fakeTrackingNumber}`,
      rawResponse: response,
    };
  }

  /**
   * Core: Track Shipment
   * Uses httpbin.org to simulate a network request with latency.
   */
  @Retryable({ retries: 3, delayMs: 200 })
  async trackShipment(trackingNumber: string): Promise<TrackingResDto> {
    this.logger.log(`Tracking shipment ${trackingNumber}...`);

    // Simulate API call with latency
    // This proves our httpGet method and retry logic (if this fails) work.
    await this.httpService.axiosRef.get('https://httpbin.org/delay/1');

    // Mock events since httpbin doesn't store shipment state
    const rawEvents = [
      {
        status: 'DATA_RECEIVED',
        time: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        location: 'Riyadh Hub',
      },
      {
        status: 'OUT_FOR_DELIVERY',
        time: new Date().toISOString(),
        location: 'Jeddah',
      },
    ];

    // Map to Unified Format
    const history = rawEvents.map((event) => ({
      status: this.mapStatus(event.status),
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

  @Retryable({ retries: 3, delayMs: 200 })
  async getLabel(trackingNumber: string): Promise<string> {
    this.logger.log(`Fetching label for ${trackingNumber}...`);
    // Verify connectivity by fetching a small status response
    await this.httpService.axiosRef.get('https://httpbin.org/status/200');

    // In a real app, we might return the buffer or a signed URL.
    return `https://demo.smsa.com/labels/${trackingNumber}.pdf`;
  }

  @Retryable({ retries: 3, delayMs: 200 })
  async cancelShipment(trackingNumber: string): Promise<boolean> {
    this.logger.log(`Cancelling shipment ${trackingNumber}`);

    // Simulate Cancellation API call
    await this.httpService.axiosRef.post('https://httpbin.org/post', {
      action: 'cancel',
      awb: trackingNumber,
    });

    return true;
  }
}
