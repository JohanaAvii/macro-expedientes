-- CreateTable
CREATE TABLE "TipoDocumento" (
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "abreviatura" TEXT,

    CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "EmpresaMensajeria" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "EmpresaMensajeria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expediente" (
    "id" TEXT NOT NULL,
    "sujetoImpuesto" TEXT NOT NULL,
    "numeroExpediente" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoExpediente" (
    "id" TEXT NOT NULL,
    "documentoExpedienteId" TEXT NOT NULL,
    "numeroExpediente" TEXT NOT NULL,
    "sujetoImpuesto" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "tipoDocumentoCodigo" TEXT,
    "nombre" TEXT NOT NULL,
    "estado" TEXT,
    "fechaDocumento" TIMESTAMP(3),
    "actividadExp" TEXT,
    "archivoUrl" TEXT,
    "archivoNombreOriginal" TEXT,

    CONSTRAINT "DocumentoExpediente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionDocumento" (
    "id" TEXT NOT NULL,
    "notificacion" TEXT NOT NULL,
    "documentoExpedienteId" TEXT NOT NULL,
    "numeroGuia" TEXT NOT NULL,
    "estadoEnvio" TEXT NOT NULL,

    CONSTRAINT "NotificacionDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionOficial" (
    "id" TEXT NOT NULL,
    "liquidacionOficialId" TEXT NOT NULL,
    "sujetoImpuesto" TEXT NOT NULL,
    "numeroLiquidacionOficial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidacionOficial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionLiquidacion" (
    "id" TEXT NOT NULL,
    "notificacion" TEXT NOT NULL,
    "numeroNotificacion" TEXT NOT NULL,
    "numeroGuia" TEXT NOT NULL,
    "numeroLiquidacionOficial" TEXT NOT NULL,

    CONSTRAINT "NotificacionLiquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'OPERATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultaAuditoria" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criterio" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "ConsultaAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaMensajeria_codigo_key" ON "EmpresaMensajeria"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Expediente_numeroExpediente_key" ON "Expediente"("numeroExpediente");

-- CreateIndex
CREATE INDEX "Expediente_sujetoImpuesto_idx" ON "Expediente"("sujetoImpuesto");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoExpediente_documentoExpedienteId_key" ON "DocumentoExpediente"("documentoExpedienteId");

-- CreateIndex
CREATE INDEX "DocumentoExpediente_numeroExpediente_idx" ON "DocumentoExpediente"("numeroExpediente");

-- CreateIndex
CREATE INDEX "DocumentoExpediente_sujetoImpuesto_idx" ON "DocumentoExpediente"("sujetoImpuesto");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionDocumento_notificacion_key" ON "NotificacionDocumento"("notificacion");

-- CreateIndex
CREATE INDEX "NotificacionDocumento_documentoExpedienteId_idx" ON "NotificacionDocumento"("documentoExpedienteId");

-- CreateIndex
CREATE INDEX "NotificacionDocumento_numeroGuia_idx" ON "NotificacionDocumento"("numeroGuia");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionOficial_liquidacionOficialId_key" ON "LiquidacionOficial"("liquidacionOficialId");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionOficial_numeroLiquidacionOficial_key" ON "LiquidacionOficial"("numeroLiquidacionOficial");

-- CreateIndex
CREATE INDEX "LiquidacionOficial_sujetoImpuesto_idx" ON "LiquidacionOficial"("sujetoImpuesto");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionLiquidacion_notificacion_key" ON "NotificacionLiquidacion"("notificacion");

-- CreateIndex
CREATE INDEX "NotificacionLiquidacion_numeroLiquidacionOficial_idx" ON "NotificacionLiquidacion"("numeroLiquidacionOficial");

-- CreateIndex
CREATE INDEX "NotificacionLiquidacion_numeroGuia_idx" ON "NotificacionLiquidacion"("numeroGuia");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_numeroExpediente_fkey" FOREIGN KEY ("numeroExpediente") REFERENCES "Expediente"("numeroExpediente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoExpediente" ADD CONSTRAINT "DocumentoExpediente_tipoDocumentoCodigo_fkey" FOREIGN KEY ("tipoDocumentoCodigo") REFERENCES "TipoDocumento"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionDocumento" ADD CONSTRAINT "NotificacionDocumento_documentoExpedienteId_fkey" FOREIGN KEY ("documentoExpedienteId") REFERENCES "DocumentoExpediente"("documentoExpedienteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionLiquidacion" ADD CONSTRAINT "NotificacionLiquidacion_numeroLiquidacionOficial_fkey" FOREIGN KEY ("numeroLiquidacionOficial") REFERENCES "LiquidacionOficial"("numeroLiquidacionOficial") ON DELETE RESTRICT ON UPDATE CASCADE;
