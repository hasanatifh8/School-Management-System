-- AlterTable
ALTER TABLE "School" ADD COLUMN     "leaveRules" JSONB;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "overLimitDates" TEXT[] DEFAULT ARRAY[]::TEXT[];
