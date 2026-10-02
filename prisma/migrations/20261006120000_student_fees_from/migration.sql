-- Students: optionally charge fees from an earlier month than the admission month.

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "feesFrom" DATE;

