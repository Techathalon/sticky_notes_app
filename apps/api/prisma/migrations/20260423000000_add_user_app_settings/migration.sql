CREATE TABLE "user_app_settings" (
  "id"                    TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "alarmsEnabled"         BOOLEAN NOT NULL DEFAULT true,
  "taskReminderEnabled"   BOOLEAN NOT NULL DEFAULT true,
  "taskReminderTime"      TEXT NOT NULL DEFAULT '00:30',
  "eventReminderEnabled"  BOOLEAN NOT NULL DEFAULT true,
  "eventReminderTime"     TEXT NOT NULL DEFAULT '00:30',
  "expenseSummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "expenseSummaryTime"    TEXT NOT NULL DEFAULT '20:00',
  "budget80AlertEnabled"  BOOLEAN NOT NULL DEFAULT true,
  "budget100AlertEnabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_app_settings_userId_key" ON "user_app_settings"("userId");

ALTER TABLE "user_app_settings"
  ADD CONSTRAINT "user_app_settings_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
