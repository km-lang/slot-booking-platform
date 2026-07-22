-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('CV', 'GD', 'CASE');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('SOLVER', 'SHADOW');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "role" "ParticipantRole",
ALTER COLUMN "focus" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BookingRelease" ADD COLUMN     "capacity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "slotType" "SlotType" NOT NULL DEFAULT 'CV';

-- AlterTable
ALTER TABLE "SlotCapacity" ADD COLUMN     "solverClaimed" BOOLEAN NOT NULL DEFAULT false;
