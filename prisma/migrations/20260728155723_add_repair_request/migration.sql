-- CreateTable
CREATE TABLE "RepairRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT,
    "problem" TEXT NOT NULL,
    "requestedService" TEXT,
    "clientSignerName" TEXT NOT NULL,
    "clientSignerTitle" TEXT,
    "clientSignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepairRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepairRequest_requestNumber_key" ON "RepairRequest"("requestNumber");
