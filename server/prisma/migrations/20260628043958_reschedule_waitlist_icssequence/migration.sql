-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "icsSequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SlotWaitlist" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlotWaitlist_slotId_studentUserId_key" ON "SlotWaitlist"("slotId", "studentUserId");

-- AddForeignKey
ALTER TABLE "SlotWaitlist" ADD CONSTRAINT "SlotWaitlist_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotWaitlist" ADD CONSTRAINT "SlotWaitlist_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
