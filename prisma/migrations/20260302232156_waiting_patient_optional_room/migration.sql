-- CreateTable
CREATE TABLE "PatientVitals" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "temperature" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "bmi" DOUBLE PRECISION,
    "pulseRate" INTEGER,
    "spo2" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientVitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultingRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "staffId" TEXT,

    CONSTRAINT "ConsultingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitingPatient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultingRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "staffId" TEXT,

    CONSTRAINT "WaitingPatient_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PatientVitals" ADD CONSTRAINT "PatientVitals_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultingRoom" ADD CONSTRAINT "ConsultingRoom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultingRoom" ADD CONSTRAINT "ConsultingRoom_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultingRoom" ADD CONSTRAINT "ConsultingRoom_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_consultingRoomId_fkey" FOREIGN KEY ("consultingRoomId") REFERENCES "ConsultingRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitingPatient" ADD CONSTRAINT "WaitingPatient_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
