-- AlterTable
ALTER TABLE "RepairRequest" ADD COLUMN     "deliveryMethod" TEXT;

-- AlterTable
ALTER TABLE "TurnaroundJob" ADD COLUMN     "deliveryMethod" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedByPsi" TEXT,
ADD COLUMN     "releasedByClient" TEXT;
