-- Transport: a monthly fare for each stop, in the same order as the stops.

-- AlterTable
ALTER TABLE "TransportRoute" ADD COLUMN     "stopFares" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
