-- AlterTable
ALTER TABLE "TurnaroundJob" ADD COLUMN     "isBatch" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "JobUnit" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT,
    "problem" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "clientSignerName" TEXT NOT NULL,
    "clientSignerTitle" TEXT,
    "clientSignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryMethod" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestBatchItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT,
    "problem" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RequestBatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobUnit_jobId_idx" ON "JobUnit"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestBatch_batchNumber_key" ON "RequestBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "RequestBatchItem_batchId_idx" ON "RequestBatchItem"("batchId");

-- AddForeignKey
ALTER TABLE "JobUnit" ADD CONSTRAINT "JobUnit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TurnaroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestBatchItem" ADD CONSTRAINT "RequestBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RequestBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
