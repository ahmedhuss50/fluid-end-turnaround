-- CreateTable
CREATE TABLE "FluidEnd" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "model" TEXT,
    "tagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FluidEnd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnaroundJob" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "fluidEndId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "technician" TEXT NOT NULL,
    "intakeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedDate" TIMESTAMP(3),
    "replacedParts" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurnaroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressureTest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "testPressurePsi" INTEGER NOT NULL,
    "holdTimeMinutes" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "gauge" TEXT,
    "testedBy" TEXT NOT NULL,
    "testedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PressureTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT,
    "signerEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "auditIp" TEXT,
    "auditMeta" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FluidEnd_serialNumber_key" ON "FluidEnd"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TurnaroundJob_jobNumber_key" ON "TurnaroundJob"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PressureTest_jobId_key" ON "PressureTest"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_token_key" ON "Signature"("token");

-- CreateIndex
CREATE INDEX "Signature_jobId_idx" ON "Signature"("jobId");

-- AddForeignKey
ALTER TABLE "TurnaroundJob" ADD CONSTRAINT "TurnaroundJob_fluidEndId_fkey" FOREIGN KEY ("fluidEndId") REFERENCES "FluidEnd"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressureTest" ADD CONSTRAINT "PressureTest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TurnaroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TurnaroundJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
