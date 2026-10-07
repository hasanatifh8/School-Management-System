-- Transport: a pick-up time for each stop, in the same order as the stops.

-- AlterTable
ALTER TABLE "TransportRoute" ADD COLUMN     "stopTimes" TEXT[] DEFAULT ARRAY[]::TEXT[];
