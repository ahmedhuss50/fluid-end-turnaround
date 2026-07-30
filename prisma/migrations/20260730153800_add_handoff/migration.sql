-- CreateTable
CREATE TABLE "Handoff" (
    "id" TEXT NOT NULL,
    "handoffNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "customer" TEXT NOT NULL,
    "deliveryMethod" TEXT,
    "conditionNotes" TEXT,
    "releasedByName" TEXT NOT NULL,
    "releasedByTitle" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedByName" TEXT,
    "receivedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RELEASED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Handoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Handoff_handoffNumber_key" ON "Handoff"("handoffNumber");
