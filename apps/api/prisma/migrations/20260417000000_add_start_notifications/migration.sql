-- Add startAt and startNotifSentAt to todos
ALTER TABLE "todos" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "todos" ADD COLUMN "startNotifSentAt" TIMESTAMP(3);

-- Add startNotifSentAt to events
ALTER TABLE "events" ADD COLUMN "startNotifSentAt" TIMESTAMP(3);

-- Backfill startAt for existing todos that have both dueDate and dueTime
UPDATE "todos"
SET "startAt" = (
  "dueDate"::date + (
    SPLIT_PART("dueTime", ':', 1)::int * INTERVAL '1 hour' +
    SPLIT_PART("dueTime", ':', 2)::int * INTERVAL '1 minute'
  )
)
WHERE "dueDate" IS NOT NULL AND "dueTime" IS NOT NULL;

-- Indexes for cron job performance
CREATE INDEX "todos_startAt_idx" ON "todos"("startAt");
CREATE INDEX "events_startDate_idx" ON "events"("startDate");
