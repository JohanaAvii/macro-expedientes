/**
 * SUBIDOR DE PDFs — desde tu carpeta local hacia almacenamiento en la nube
 * -------------------------------------------------------------------------
 * Este script recorre tu carpeta "Expedientes a entregar" (estructura:
 *   Expedientes a entregar/<NumeroExpediente>/<DocumentoExpedienteId>.pdf )
 * sube cada PDF a Vercel Blob, y guarda la URL resultante en el campo
 * `archivoUrl` del documento correspondiente en la base de datos.
 *
 * Requisitos antes de correrlo:
 *   1. Activa "Blob" en tu proyecto de Vercel: Storage → Create → Blob.
 *      Copia el token que te da (BLOB_READ_WRITE_TOKEN).
 *   2. En tu .env agrega:
 *        BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
 *        DATABASE_URL="postgresql://..."   (la misma que ya usas)
 *   3. Los NumeroExpediente y DocumentoExpedienteId deben existir ya en la
 *      base de datos (corre primero scripts/importar-datos.ts).
 *
 * Cómo correrlo (ejemplo con tu ruta real):
 *   npx tsx scripts/subir-pdfs.ts "D:\MacroPc\PRESCRIPCIONE\Expedientes a entregar"
 *
 * El script es reanudable: si se corta a la mitad (61.498 carpetas puede
 * tardar), puedes volver a correrlo y se salta los PDF que ya tienen
 * archivoUrl guardado.
 */

import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const carpetaRaiz = process.argv[2];
  if (!carpetaRaiz) {
    console.error('Uso: npx tsx scripts/subir-pdfs.ts "RUTA\\A\\Expedientes a entregar"');
    process.exit(1);
  }
  if (!fs.existsSync(carpetaRaiz)) {
    console.error("No existe la ruta:", carpetaRaiz);
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Falta BLOB_READ_WRITE_TOKEN en tu .env — actívalo en Vercel → Storage → Blob.");
    process.exit(1);
  }

  const carpetasExpediente = fs.readdirSync(carpetaRaiz, { withFileTypes: true }).filter((d) => d.isDirectory());

  console.log(`Encontradas ${carpetasExpediente.length} carpetas de expediente en ${carpetaRaiz}`);

  let subidos = 0;
  let yaExistian = 0;
  let sinCoincidencia = 0;
  let errores = 0;

  for (const carpeta of carpetasExpediente) {
    const numeroExpediente = carpeta.name.trim();
    const rutaCarpeta = path.join(carpetaRaiz, carpeta.name);

    const archivos = fs.readdirSync(rutaCarpeta).filter((f) => f.toLowerCase().endsWith(".pdf"));

    for (const archivo of archivos) {
      const documentoExpedienteId = path.basename(archivo, path.extname(archivo)).trim();

      const documento = await prisma.documentoExpediente.findUnique({
        where: { documentoExpedienteId }
      });

      if (!documento) {
        sinCoincidencia++;
        console.warn(`⚠ Sin registro en la BD para documento ${documentoExpedienteId} (expediente ${numeroExpediente}) — se omite.`);
        continue;
      }

      if (documento.archivoUrl) {
        yaExistian++;
        continue; // ya subido en una corrida anterior
      }

      try {
        const rutaArchivo = path.join(rutaCarpeta, archivo);
        const buffer = fs.readFileSync(rutaArchivo);

        const blob = await put(`expedientes/${numeroExpediente}/${documentoExpedienteId}.pdf`, buffer, {
          access: "public",
          contentType: "application/pdf",
          token: process.env.BLOB_READ_WRITE_TOKEN
        });

        await prisma.documentoExpediente.update({
          where: { documentoExpedienteId },
          data: { archivoUrl: blob.url, archivoNombreOriginal: archivo }
        });

        subidos++;
        if (subidos % 100 === 0) console.log(`… ${subidos} PDF subidos`);
      } catch (e) {
        errores++;
        console.error(`✗ Error subiendo ${archivo}:`, (e as Error).message);
      }
    }
  }

  console.log("\nResumen:");
  console.log(`  Subidos ahora:        ${subidos}`);
  console.log(`  Ya existían:           ${yaExistian}`);
  console.log(`  Sin registro en BD:    ${sinCoincidencia}`);
  console.log(`  Errores:               ${errores}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
