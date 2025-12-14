-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED');

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "orderReference" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "courierRef" TEXT,
    "labelUrl" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "senderDetails" JSONB NOT NULL,
    "receiverDetails" JSONB NOT NULL,
    "dimensions" JSONB NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "rawStatus" TEXT,
    "description" TEXT,
    "location" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_trackingNumber_key" ON "shipments"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipments_orderReference_idx" ON "shipments"("orderReference");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
