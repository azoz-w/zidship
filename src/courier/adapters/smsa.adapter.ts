import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ICourierAdapter } from '../interface/courier.interface';
import {
  CreateWaybillReqDto,
  CreateWaybillResDto,
  TrackingResDto,
} from '../dto';
import { ShipmentStatus } from 'src/generated/prisma/enums';

@Injectable()
export class SmsaAdapter implements ICourierAdapter {
  private readonly logger = new Logger(SmsaAdapter.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('SMSA_API_KEY');
    const apiUrl = this.configService.get<string>('SMSA_API_URL');
    if (!apiKey) {
      throw new Error(
        'SMSA_API_KEY is not defined in the environment variables',
      );
    }
    if (!apiUrl) {
      throw new Error(
        'SMSA_API_URL is not defined in the environment variables',
      );
    }
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  readonly providerId = 'smsa';

  readonly capabilities = {
    cancellation: true,
    printLabel: true,
  };

  /**
   * REAL HTTP Call to create a shipment
   */
  async createWaybill(
    input: CreateWaybillReqDto,
  ): Promise<CreateWaybillResDto> {
    this.logger.log(
      `[SMSA] Creating waybill for Order ${input.orderReference}`,
    );

    // 1. Map Our DTO to SMSA Specific JSON Payload
    const payload = {
      refNo: input.orderReference,
      sName: input.sender.name,
      sPhone: input.sender.phone,
      sAddress: input.sender.address,
      sCity: input.sender.city,
      sCntry: input.sender.countryCode,
      rName: input.receiver.name,
      rPhone: input.receiver.phone,
      rAddress: input.receiver.address,
      rCity: input.receiver.city,
      rCntry: input.receiver.countryCode,
      weight: input.dimensions.weight,
    };

    try {
      // 2. Execute the HTTP POST request
      const response = await firstValueFrom(
        this.httpService.post(`${this.apiUrl}/create-shipment`, payload, {
          headers: { apikey: this.apiKey },
        }),
      );

      const data = response.data;

      // 3. Handle Provider-Specific Errors
      if (data.error) {
        throw new BadRequestException(`SMSA Error: ${data.message}`);
      }

      // 4. Return Normalized Result
      return {
        trackingNumber: data.awbNo,
        courierRef: data.refNo,
        labelUrl: data.labelUrl, // e.g. "https://smsa.com/pdf/123"
        rawResponse: data, // Save this to DB for audit
      };
    } catch (error) {
      this.logger.error(
        `[SMSA] Failed to create waybill`,
        error.response?.data,
      );
      // Re-throw so our Retry Mechanism (Queue) catches it!
      throw new InternalServerErrorException(
        'SMSA API is unreachable or returned error',
      );
    }
  }

  /**
   * REAL HTTP Call to get status
   */
  async trackShipment(trackingNumber: string): Promise<TrackingResDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/tracking/${trackingNumber}`, {
          headers: { apikey: this.apiKey },
        }),
      );

      const history = response.data.updates.map((event) => ({
        status: this.mapStatus(event.activity), // Map "Received" -> "CREATED"
        rawStatus: event.activity,
        description: event.details,
        eventDate: new Date(event.date),
      }));

      return {
        trackingNumber,
        currentStatus: history[history.length - 1].status,
        events: history,
      };
    } catch (error) {
      this.logger.error(`[SMSA] Tracking failed`, error);
      throw error;
    }
  }

  async getLabel(trackingNumber: string): Promise<string> {
    // Some providers return a URL, others return a Base64 string
    // Here we assume they return a direct public URL
    return `${this.apiUrl}/print/${trackingNumber}`;
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/cancel/${trackingNumber}`,
          {},
          {
            headers: { apikey: this.apiKey },
          },
        ),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * The Critical Logic: Translating SMSA statuses to ZidShip statuses
   *
   */
  mapStatus(rawStatus: string): ShipmentStatus {
    const status = rawStatus.toUpperCase();
    if (status.includes('RECEIVED')) return ShipmentStatus.CREATED;
    if (status.includes('WITH COURIER')) return ShipmentStatus.PICKED_UP;
    if (status.includes('OUT FOR DELIVERY'))
      return ShipmentStatus.OUT_FOR_DELIVERY;
    if (status.includes('DELIVERED')) return ShipmentStatus.DELIVERED;
    return ShipmentStatus.PENDING;
  }
}
