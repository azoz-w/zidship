export interface CreateWaybillResDto {
  trackingNumber: string;
  courierRef: string; // Internal ID from the courier
  labelUrl?: string; // URL if available immediately
  rawResponse: any; // Store raw JSON for debugging [cite: 7]
}
