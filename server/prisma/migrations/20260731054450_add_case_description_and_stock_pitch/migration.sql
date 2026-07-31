-- AlterEnum
ALTER TYPE "SlotType" ADD VALUE 'STOCK_PITCH';

-- AlterTable
ALTER TABLE "BookingRelease" ADD COLUMN     "caseDescription" TEXT;
