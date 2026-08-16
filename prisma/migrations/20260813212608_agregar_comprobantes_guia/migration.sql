-- AlterTable
ALTER TABLE "NotificacionDocumento" ADD COLUMN     "archivoNombreOriginal" TEXT,
ADD COLUMN     "archivoUrl" TEXT;

-- AlterTable
ALTER TABLE "NotificacionLiquidacion" ADD COLUMN     "archivoNombreOriginal" TEXT,
ADD COLUMN     "archivoUrl" TEXT;
