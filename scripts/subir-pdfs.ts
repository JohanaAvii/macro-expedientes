/**
 * SUBIDOR DE PDFs — desde tu carpeta local hacia almacenamiento en la nube
 * -------------------------------------------------------------------------
 * Versión optimizada: en vez de consultar la base de datos una vez por
 * cada PDF (esto saturaba la conexión de Neon y la cortaba a mitad de
 * camino), carga UNA sola vez en memoria qué documentos existen y cuáles
 * ya tienen archivo subido. Además, reintenta automáticamente si la
 * conexión a la base de datos se cae momentáneamente (normal en Neon con
 * procesos largos).
 *
 * Cómo correrlo (ejemplo con tu ruta real):
 *   npm run importar:pdfs -- "D:\MacroPc\PRESCRIPCIONE\Expedientes a entregar"
 *
 * Es reanudable: si se corta a la mitad, corre el mismo comando de nuevo
 * y continúa donde quedó, sin volver a subir lo ya cargado.
 */

import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Reintenta una operación async hasta `intentos` veces, con una pequeña
// espera entre cada intento (útil para conexiones que se cortan solas).
async function conReintento<T>(fn: () => Promise<T>, intentos = 4, esperaMs = 1500): Promise<T> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoError = e;
      if (i < intentos - 1) await new Promise((r) => setTimeout(r, esperaMs * (i + 1)));
    }
  }
  throw ultimoError;
}

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
    console.error("Falta BLOB_READ_WRITE_TOKEN en tu .env — actívalo en tu store de Blob.");
    process.exit(1);
  }

  console.log("Cargando en memoria la lista de documentos válidos (una sola vez)…");
  const documentosDb = await conReintento(() =>
    prisma.documentoExpediente.findMany({
      select: { documentoExpedienteId: true, archivoUrl: true }
    })
  );
  const idsValidos = new Set(documentosDb.map((d) => d.documentoExpedienteId));
  const idsYaSubidos = new Set(documentosDb.filter((d) => d.archivoUrl).map((d) => d.documentoExpedienteId));
  console.log(`Documentos en la base de datos: ${idsValidos.size} (${idsYaSubidos.size} ya tienen archivo)\n`);

  const carpetasExpediente = fs.readdirSync(carpetaRaiz, { withFileTypes: true }).filter((d) => d.isDirectory());
  console.log(`Encontradas ${carpetasExpediente.length} carpetas de expediente en ${carpetaRaiz}`);

  let subidos = 0;
  let yaExistian = 0;
  let sinCoincidencia = 0;
  let errores = 0;
  const ejemplosSinCoincidencia: string[] = [];
  const actualizacionesPendientes: { documentoExpedienteId: string; url: string; nombreOriginal: string }[] = [];

  const FLUSH_CADA = 200; // agrupa las actualizaciones a la BD en tandas

  async function flushActualizaciones() {
    if (actualizacionesPendientes.length === 0) return;
    const lote = actualizacionesPendientes.splice(0, actualizacionesPendientes.length);
    for (const item of lote) {
      try {
        await conReintento(() =>
          prisma.documentoExpediente.update({
            where: { documentoExpedienteId: item.documentoExpedienteId },
            data: { archivoUrl: item.url, archivoNombreOriginal: item.nombreOriginal }
          })
        );
      } catch (e) {
        errores++;
        console.error(`✗ No se pudo guardar en la BD el enlace de ${item.documentoExpedienteId}:`, (e as Error).message);
      }
    }
  }

  let procesados = 0;

  for (const carpeta of carpetasExpediente) {
    const numeroExpediente = carpeta.name.trim();
    const rutaCarpeta = path.join(carpetaRaiz, carpeta.name);

    let archivos: string[] = [];
    try {
      archivos = fs.readdirSync(rutaCarpeta).filter((f) => f.toLowerCase().endsWith(".pdf"));
    } catch {
      continue; // carpeta ilegible, se salta
    }

    for (const archivo of archivos) {
      const documentoExpedienteId = path.basename(archivo, path.extname(archivo)).trim();

      if (!idsValidos.has(documentoExpedienteId)) {
        sinCoincidencia++;
        if (ejemplosSinCoincidencia.length < 20) {
          ejemplosSinCoincidencia.push(`${documentoExpedienteId} (expediente ${numeroExpediente})`);
        }
        continue;
      }

      if (idsYaSubidos.has(documentoExpedienteId)) {
        yaExistian++;
        continue;
      }

      try {
        const rutaArchivo = path.join(rutaCarpeta, archivo);
        const buffer = fs.readFileSync(rutaArchivo);

        const blob = await conReintento(
          () =>
            put(`expedientes/${numeroExpediente}/${documentoExpedienteId}.pdf`, buffer, {
              access: "public",
              contentType: "application/pdf",
              token: process.env.BLOB_READ_WRITE_TOKEN
            }),
          3,
          2000
        );

        actualizacionesPendientes.push({ documentoExpedienteId, url: blob.url, nombreOriginal: archivo });
        idsYaSubidos.add(documentoExpedienteId); // evita reintentar si aparece dos veces
        subidos++;

        if (actualizacionesPendientes.length >= FLUSH_CADA) {
          await flushActualizaciones();
        }

        if (subidos % 100 === 0) console.log(`… ${subidos} PDF subidos`);
      } catch (e) {
        errores++;
        console.error(`✗ Error subiendo ${archivo}:`, (e as Error).message);
      }
    }

    procesados++;
    if (procesados % 500 === 0) {
      console.log(`  (carpetas procesadas: ${procesados} / ${carpetasExpediente.length})`);
    }
  }

  await flushActualizaciones();

  console.log("\nResumen:");
  console.log(`  Subidos ahora:        ${subidos}`);
  console.log(`  Ya existían:           ${yaExistian}`);
  console.log(`  Sin registro en BD:    ${sinCoincidencia}`);
  console.log(`  Errores:               ${errores}`);
  if (ejemplosSinCoincidencia.length) {
    console.log("\nEjemplos sin registro en BD (nombre de archivo no coincide con ningún DocumentoExpedienteId):");
    ejemplosSinCoincidencia.forEach((e) => console.log(`  - ${e}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());