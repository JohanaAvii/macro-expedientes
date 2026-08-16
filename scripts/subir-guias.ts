/**
 * SUBIR COMPROBANTES DE GUÍA — imágenes de soporte de entrega/devolución
 * -------------------------------------------------------------------------
 * Esta es una fuente de archivos DISTINTA a "Expedientes a entregar": aquí
 * cada carpeta representa un número de guía (no un expediente), con una
 * imagen adentro (el comprobante de entrega o devolución del envío).
 *
 * Estructura esperada (con varias carpetas "categoría" en la raíz, cada
 * una con subcarpetas nombradas por número de guía):
 *   Notificaciones/
 *     Liquidaciones_Oficiales/<numeroGuia>/<archivo>
 *     Soporte Entregadas/<numeroGuia>/<archivo>
 *     Soporte Devolución/<numeroGuia>/<archivo>
 *     ... (cualquier otra carpeta con el mismo patrón)
 *
 * El script recorre TODO el árbol recursivamente. Cualquier carpeta que ya
 * no tenga subcarpetas (una carpeta "hoja") se trata como candidata a
 * número de guía, y su nombre se intenta cruzar contra:
 *   - NotificacionDocumento.numeroGuia   (Cartera Predial)
 *   - NotificacionLiquidacion.numeroGuia (Cartera ICA)
 * Si coincide con alguna (o ambas), se sube la imagen y se enlaza. Si no
 * coincide con ninguna, se cuenta como "sin coincidencia" y se sigue de
 * largo — no se pierde nada, simplemente no se pudo enlazar.
 *
 * Cómo correrlo:
 *   npm run subir:guias -- "D:\MacroPc\PRESCRIPCIONE\Notificaciones"
 *
 * Es reanudable: si se corta a la mitad, corre el mismo comando de nuevo
 * y continúa donde quedó, sin volver a subir lo ya cargado.
 */

import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function conReintento<T>(fn: () => Promise<T>, intentos = 6, esperaMs = 2000): Promise<T> {
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

// Detecta el tipo de imagen por los primeros bytes, porque muchos de estos
// archivos no tienen extensión (Windows los muestra como "Archivo").
function detectarContentType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.toString("hex", 0, 8) === "89504e470d0a1a0a") return "image/png";
  if (buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) return "image/gif";
  if (buffer.length >= 2 && buffer.toString("ascii", 0, 2) === "BM") return "image/bmp";
  if (buffer.length >= 4 && (buffer.toString("hex", 0, 4) === "49492a00" || buffer.toString("hex", 0, 4) === "4d4d002a")) return "image/tiff";
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  return "application/octet-stream";
}

function extensionParaContentType(tipo: string): string {
  const mapa: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "application/pdf": ".pdf"
  };
  return mapa[tipo] ?? "";
}

async function main() {
  const carpetaRaiz = process.argv[2];
  if (!carpetaRaiz) {
    console.error('Uso: npx tsx scripts/subir-guias.ts "RUTA\\A\\Notificaciones"');
    process.exit(1);
  }
  if (!fs.existsSync(carpetaRaiz)) {
    console.error("No existe la ruta:", carpetaRaiz);
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Falta BLOB_READ_WRITE_TOKEN en tu .env.");
    process.exit(1);
  }

  console.log("Cargando en memoria las guías y liquidaciones ya cargadas (para no repetir trabajo)…");
  const [docsConGuia, liqsConGuia, liquidacionesConPdf] = await Promise.all([
    prisma.notificacionDocumento.findMany({ where: { archivoUrl: { not: null } }, select: { numeroGuia: true } }),
    prisma.notificacionLiquidacion.findMany({ where: { archivoUrl: { not: null } }, select: { numeroGuia: true } }),
    prisma.liquidacionOficial.findMany({ where: { archivoUrl: { not: null } }, select: { numeroLiquidacionOficial: true } })
  ]);
  const guiasYaListasDoc = new Set(docsConGuia.map((d) => d.numeroGuia));
  const guiasYaListasLiq = new Set(liqsConGuia.map((l) => l.numeroGuia));
  const liquidacionesYaListas = new Set(liquidacionesConPdf.map((l) => l.numeroLiquidacionOficial));
  console.log(
    `Ya cargadas — Predial: ${guiasYaListasDoc.size}, ICA (guía): ${guiasYaListasLiq.size}, Liquidaciones (PDF propio): ${liquidacionesYaListas.size}\n`
  );

  let carpetasHoja = 0;
  let subidas = 0;
  let enlazadasPredial = 0;
  let enlazadasIca = 0;
  let enlazadasLiquidacion = 0;
  let sinCoincidencia = 0;
  let errores = 0;
  const ejemplosSinCoincidencia: string[] = [];

  async function procesarCarpetaHoja(rutaCarpeta: string, identificador: string, esCarpetaLiquidacion: boolean) {
    carpetasHoja++;

    const yaListaDoc = guiasYaListasDoc.has(identificador);
    const yaListaLiqGuia = guiasYaListasLiq.has(identificador);
    const yaListaLiquidacion = liquidacionesYaListas.has(identificador);

    // Según la carpeta donde estemos paradas, solo aplica UN tipo de
    // cruce — no los tres. Esto es lo que antes hacía que el script
    // repitiera trabajo ya hecho al reanudar.
    const yaListoParaEstaCarpeta = esCarpetaLiquidacion ? yaListaLiquidacion : yaListaDoc && yaListaLiqGuia;

    if (yaListoParaEstaCarpeta) {
      if (carpetasHoja % 500 === 0) {
        console.log(
          `  … carpetas procesadas: ${carpetasHoja} (subidas: ${subidas}, predial: ${enlazadasPredial}, ICA-guía: ${enlazadasIca}, liquidación-PDF: ${enlazadasLiquidacion})`
        );
      }
      return; // ya está resuelto, ni siquiera abrimos el archivo
    }

    let archivos: string[] = [];
    try {
      archivos = fs.readdirSync(rutaCarpeta).filter((f) => fs.statSync(path.join(rutaCarpeta, f)).isFile());
    } catch {
      return;
    }
    if (archivos.length === 0) return;

    const nombreArchivo = archivos[0]; // normalmente hay uno solo por carpeta

    try {
      const rutaArchivo = path.join(rutaCarpeta, nombreArchivo);
      const buffer = fs.readFileSync(rutaArchivo);
      // El nombre real del archivo puede venir con una extensión puesta a
      // mano que no corresponde (ej. alguien le agregó ".jpg" a un PDF).
      // Por eso el tipo se detecta por el contenido real, no por el nombre.
      const contentType = detectarContentType(buffer);
      const ext = extensionParaContentType(contentType) || path.extname(nombreArchivo) || "";

      const blob = await conReintento(() =>
        put(`guias/${identificador}${ext}`, buffer, {
          access: "public",
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
          allowOverwrite: true
        })
      );
      const archivoUrl = blob.url;
      subidas++;

      let coincidio = false;

      if (esCarpetaLiquidacion) {
        // Carpeta "Liquidaciones_Oficiales": el identificador es el número
        // de la liquidación misma (el PDF del documento), no una guía.
        const resultado = await conReintento(() =>
          prisma.liquidacionOficial.updateMany({
            where: { numeroLiquidacionOficial: identificador },
            data: { archivoUrl, archivoNombreOriginal: nombreArchivo }
          })
        );
        if (resultado.count > 0) {
          enlazadasLiquidacion += resultado.count;
          coincidio = true;
        }
      } else {
        if (!yaListaDoc) {
          const resultado = await conReintento(() =>
            prisma.notificacionDocumento.updateMany({
              where: { numeroGuia: identificador },
              data: { archivoUrl, archivoNombreOriginal: nombreArchivo }
            })
          );
          if (resultado.count > 0) {
            enlazadasPredial += resultado.count;
            coincidio = true;
          }
        }

        if (!yaListaLiqGuia) {
          const resultado = await conReintento(() =>
            prisma.notificacionLiquidacion.updateMany({
              where: { numeroGuia: identificador },
              data: { archivoUrl, archivoNombreOriginal: nombreArchivo }
            })
          );
          if (resultado.count > 0) {
            enlazadasIca += resultado.count;
            coincidio = true;
          }
        }
      }

      if (!coincidio) {
        sinCoincidencia++;
        if (ejemplosSinCoincidencia.length < 20) ejemplosSinCoincidencia.push(identificador);
      }
    } catch (e) {
      errores++;
      console.error(`✗ Error con ${identificador}:`, (e as Error).message);
    }

    if (carpetasHoja % 500 === 0) {
      console.log(
        `  … carpetas procesadas: ${carpetasHoja} (subidas: ${subidas}, predial: ${enlazadasPredial}, ICA-guía: ${enlazadasIca}, liquidación-PDF: ${enlazadasLiquidacion})`
      );
    }
  }

  async function recorrer(rutaActual: string) {
    let entradas: fs.Dirent[];
    try {
      entradas = fs.readdirSync(rutaActual, { withFileTypes: true });
    } catch {
      return;
    }

    const subcarpetas = entradas.filter((e) => e.isDirectory());
    const tieneArchivos = entradas.some((e) => e.isFile());

    if (subcarpetas.length === 0) {
      // Carpeta "hoja": el nombre de esta carpeta es el número de guía
      // o el número de liquidación oficial, según a qué corresponda.
      // Lo sabemos por el primer nivel de carpeta debajo de la raíz
      // (ej. "Liquidaciones_Oficiales" vs "Soporte Entregadas").
      if (tieneArchivos) {
        const identificador = path.basename(rutaActual).trim();
        const primerNivel = path.relative(carpetaRaiz, rutaActual).split(path.sep)[0] ?? "";
        const esCarpetaLiquidacion = primerNivel.toLowerCase().includes("liquidacion");
        await procesarCarpetaHoja(rutaActual, identificador, esCarpetaLiquidacion);
      }
      return;
    }

    for (const sub of subcarpetas) {
      await recorrer(path.join(rutaActual, sub.name));
    }
  }

  console.log("Recorriendo la carpeta de Notificaciones (puede tardar)…\n");
  await recorrer(carpetaRaiz);

  console.log("\nResumen:");
  console.log(`  Carpetas procesadas:               ${carpetasHoja}`);
  console.log(`  Archivos subidos ahora:            ${subidas}`);
  console.log(`  Enlazados como guía · Predial:     ${enlazadasPredial}`);
  console.log(`  Enlazados como guía · ICA:         ${enlazadasIca}`);
  console.log(`  Enlazados como PDF de liquidación: ${enlazadasLiquidacion}`);
  console.log(`  Sin coincidencia en ninguna:       ${sinCoincidencia}`);
  console.log(`  Errores:                           ${errores}`);
  if (ejemplosSinCoincidencia.length) {
    console.log("\nEjemplos sin coincidencia (el nombre de la carpeta no coincide con ninguna guía ni liquidación):");
    ejemplosSinCoincidencia.forEach((g) => console.log(`  - ${g}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());