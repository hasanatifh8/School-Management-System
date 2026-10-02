-- Transport: bus/van routes with their stops, and each student's route and stop.

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "transportRouteId" TEXT,
ADD COLUMN     "transportStop" TEXT;

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "routeNumber" TEXT NOT NULL,
    "name" TEXT,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "attendantName" TEXT,
    "attendantPhone" TEXT,
    "stops" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_schoolId_routeNumber_key" ON "TransportRoute"("schoolId", "routeNumber");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_transportRouteId_fkey" FOREIGN KEY ("transportRouteId") REFERENCES "TransportRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

