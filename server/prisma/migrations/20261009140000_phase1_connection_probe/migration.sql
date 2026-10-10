-- CreateTable
CREATE TABLE "connection_probe" (
    "id" INTEGER NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_probe_pkey" PRIMARY KEY ("id")
);
