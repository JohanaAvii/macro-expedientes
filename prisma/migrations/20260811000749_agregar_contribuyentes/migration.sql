-- CreateTable
CREATE TABLE "Contribuyente" (
    "id" TEXT NOT NULL,
    "sujetoImpuesto" TEXT NOT NULL,
    "nombre" TEXT,
    "identificacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribuyente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contribuyente_sujetoImpuesto_key" ON "Contribuyente"("sujetoImpuesto");

-- CreateIndex
CREATE INDEX "Contribuyente_nombre_idx" ON "Contribuyente"("nombre");

-- CreateIndex
CREATE INDEX "Contribuyente_identificacion_idx" ON "Contribuyente"("identificacion");
