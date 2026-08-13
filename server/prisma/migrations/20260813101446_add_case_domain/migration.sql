-- CreateEnum
CREATE TYPE "CaseDomain" AS ENUM ('CONSULTING', 'MARKETING', 'PRODMAN', 'OPERATIONS', 'GENMAN', 'FINANCE');

-- AlterTable
ALTER TABLE "BookingRelease" ADD COLUMN     "domain" "CaseDomain";
