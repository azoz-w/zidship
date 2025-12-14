import { ShipmentStatus } from 'src/generated/prisma/enums';
import {
  TrackingResDto,
  CreateWaybillReqDto,
  CreateWaybillResDto,
} from '../dto';
// --- The Core Strategy Interface ---
export interface ICourierAdapter {
  readonly providerId: string; // e.g., 'smsa', 'aramex'

  readonly capabilities: {
    cancellation: boolean;
    printLabel: boolean;
  };

  createWaybill(input: CreateWaybillReqDto): Promise<CreateWaybillResDto>;

  getLabel(trackingNumber: string): Promise<Buffer | string>;

  trackShipment(trackingNumber: string): Promise<TrackingResDto>;

  cancelShipment?(trackingNumber: string): Promise<boolean>;

  mapStatus(rawStatus: string): ShipmentStatus;
}
