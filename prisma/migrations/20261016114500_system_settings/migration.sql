CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "workDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
    "shiftStart" TEXT NOT NULL DEFAULT '08:00',
    "shiftEnd" TEXT NOT NULL DEFAULT '17:00',
    "breakPolicy" TEXT NOT NULL DEFAULT 'ACTUAL_RECORDED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
