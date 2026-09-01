ALTER TABLE "Assignment" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ScheduleRevision" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleRevision_scheduleId_version_key" ON "ScheduleRevision"("scheduleId", "version");
CREATE INDEX "ScheduleRevision_scheduleId_createdAt_idx" ON "ScheduleRevision"("scheduleId", "createdAt");
ALTER TABLE "ScheduleRevision" ADD CONSTRAINT "ScheduleRevision_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Assignment" SET "locked" = true WHERE "origin" = 'MANUAL';
