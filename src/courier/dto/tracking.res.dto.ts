import { ShipmentStatus } from 'src/generated/prisma/enums';

export interface TrackingResDto {
  trackingNumber: string;
  currentStatus: ShipmentStatus; // The UNIFIED status
  events: {
    status: ShipmentStatus; // Mapped status
    rawStatus: string; // Original string (e.g. "With Driver")
    description?: string;
    eventDate: Date;
  }[];
}
