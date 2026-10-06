-- Copy existing expense settings into user_app_settings for any user that has them
INSERT INTO "user_app_settings" (
  "id", "userId",
  "expenseSummaryEnabled", "expenseSummaryTime",
  "budget80AlertEnabled", "budget100AlertEnabled",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  ues."userId",
  ues."summaryEnabled",
  ues."summaryTime",
  ues."budget80AlertEnabled",
  ues."budget100AlertEnabled",
  NOW()
FROM "user_expense_settings" ues
ON CONFLICT ("userId") DO UPDATE SET
  "expenseSummaryEnabled" = EXCLUDED."expenseSummaryEnabled",
  "expenseSummaryTime"    = EXCLUDED."expenseSummaryTime",
  "budget80AlertEnabled"  = EXCLUDED."budget80AlertEnabled",
  "budget100AlertEnabled" = EXCLUDED."budget100AlertEnabled",
  "updatedAt"             = NOW();

-- Drop the old table
DROP TABLE "user_expense_settings";
