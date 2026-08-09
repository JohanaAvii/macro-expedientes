/**
 * IMPORTADOR DE DATOS — desde exportaciones de Access hacia PostgreSQL
 * ---------------------------------------------------------------------
 * Cómo exportar desde Access (una vez por tabla):
 *   1. Abre la tabla en Access (ej. "Expedientes").
 *   2. Clic derecho → Exportar → Excel (o "Archivo de texto" con separador ";").
 *   3. Guarda el archivo en la carpeta `data/` de este proyecto con el
 *      mismo nombre que usamos abajo (puedes cambiar el nombre en MAPA_ARCHIVOS).
 *
 * Exporta estas 5 tablas (las mismas que ya tienes en tu Access):
 *   - Expedientes                → data/expedientes.xlsx
 *   - Documento Expediente       → data/documento_expediente.xlsx
 *   - Notificaciones Documentos  → data/notificaciones_documentos.xlsx
 *   - LiquidacionesOficiales     → data/liquidaciones_oficiales.xlsx
 *   - Notificaciones Liquidaciones → data/notificaciones_liquidaciones.xlsx
 *
 * IMPORTANTE — columnas: los nombres reales de columna en tu Access pueden
 * no coincidir exactamente con los que usamos en el mockup. Abre cada
 * archivo exportado, mira los encabezados reales, y ajusta el objeto
 * `columnas` de cada función más abajo (son el único lugar que hay que tocar).
 *
 * Cómo correrlo:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/importar-datos.ts
 */

import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");

// Convierte cualquier valor leído del Excel a texto, conservando ceros
// iniciales (regla 11.1). Nunca lo tratamos como número.
function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

function leerHoja(nombreArchivo: string) {
  const ruta = path.join(DATA_DIR, nombreArchivo);
  if (!fs.existsSync(ruta)) {
    console.warn(`⚠ No se encontró ${ruta} — se omite este archivo.`);
    return null;
  }
  const libro = XLSX.readFile(ruta, { raw: false });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  // defval: "" evita que celdas vacías rompan el tipado; raw:false conserva
  // el texto tal como se ve (importante para ceros iniciales).
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "", raw: false });
}

async function importarExpedientes() {
  const filas = leerHoja("expedientes.xlsx");
  if (!filas) return;

  // 👉 Ajusta estos nombres a los encabezados reales de tu exportación.
  const columnas = { sujetoImpuesto: "SujetoImpuesto", numeroExpediente: "NumeroExpediente" };

  let ok = 0;
  for (const fila of filas) {
    const numeroExpediente = aTexto(fila[columnas.numeroExpediente]);
    const sujetoImpuesto = aTexto(fila[columnas.sujetoImpuesto]);
    if (!numeroExpediente || !sujetoImpuesto) continue;

    await prisma.expediente.upsert({
      where: { numeroExpediente },
      update: { sujetoImpuesto },
      create: { numeroExpediente, sujetoImpuesto }
    });
    ok++;
  }
  console.log(`✔ Expedientes importados: ${ok}`);
}

async function importarDocumentos() {
  const filas = leerHoja("documento_expediente.xlsx");
  if (!filas) return;

  // 👉 Ajusta estos nombres a los encabezados reales de tu exportación.
  const columnas = {
    documentoExpedienteId: "DocumentoExpedienteId",
    numeroExpediente: "NumeroExpediente",
    sujetoImpuesto: "SujetoImpuesto",
    numeroDocumento: "NumeroDocumento",
    nombre: "Nombre"
  };

  let ok = 0;
  let omitidos = 0;
  for (const fila of filas) {
    const documentoExpedienteId = aTexto(fila[columnas.documentoExpedienteId]);
    const numeroExpediente = aTexto(fila[columnas.numeroExpediente]);
    if (!documentoExpedienteId || !numeroExpediente) continue;

    // El expediente debe existir primero (se creó en importarExpedientes()).
    const existe = await prisma.expediente.findUnique({ where: { numeroExpediente } });
    if (!existe) {
      omitidos++;
      continue;
    }

    await prisma.documentoExpediente.upsert({
      where: { documentoExpedienteId },
      update: {
        numeroExpediente,
        sujetoImpuesto: aTexto(fila[columnas.sujetoImpuesto]),
        numeroDocumento: aTexto(fila[columnas.numeroDocumento]),
        nombre: aTexto(fila[columnas.nombre])
      },
      create: {
        documentoExpedienteId,
        numeroExpediente,
        sujetoImpuesto: aTexto(fila[columnas.sujetoImpuesto]),
        numeroDocumento: aTexto(fila[columnas.numeroDocumento]),
        nombre: aTexto(fila[columnas.nombre])
      }
    });
    ok++;
  }
  console.log(`✔ Documentos importados: ${ok}${omitidos ? ` (omitidos por expediente inexistente: ${omitidos})` : ""}`);
}

async function importarNotificacionesDocumentos() {
  const filas = leerHoja("notificaciones_documentos.xlsx");
  if (!filas) return;

  // 👉 Ajusta estos nombres a los encabezados reales de tu exportación.
  const columnas = {
    notificacion: "Notificacion", // si no existe una columna llave única, usa DocumentoExpedienteId + NumeroGuia combinados (ver abajo)
    documentoExpedienteId: "DocumentoExpedienteId",
    numeroGuia: "NumeroGuia",
    estadoEnvio: "EstadoEnvio"
  };

  let ok = 0;
  let omitidos = 0;
  for (const fila of filas) {
    const documentoExpedienteId = aTexto(fila[columnas.documentoExpedienteId]);
    const numeroGuia = aTexto(fila[columnas.numeroGuia]);
    if (!documentoExpedienteId || !numeroGuia) continue;

    const docExiste = await prisma.documentoExpediente.findUnique({ where: { documentoExpedienteId } });
    if (!docExiste) {
      omitidos++;
      continue;
    }

    const notificacion = aTexto(fila[columnas.notificacion]) || `${documentoExpedienteId}-${numeroGuia}`;
    const estadoEnvio = aTexto(fila[columnas.estadoEnvio]).toUpperCase();

    await prisma.notificacionDocumento.upsert({
      where: { notificacion },
      update: { documentoExpedienteId, numeroGuia, estadoEnvio },
      create: { notificacion, documentoExpedienteId, numeroGuia, estadoEnvio }
    });
    ok++;
  }
  console.log(`✔ Notificaciones de documentos importadas: ${ok}${omitidos ? ` (omitidas por documento inexistente: ${omitidos})` : ""}`);
}

async function importarLiquidaciones() {
  const filas = leerHoja("liquidaciones_oficiales.xlsx");
  if (!filas) return;

  // 👉 Ajusta estos nombres a los encabezados reales de tu exportación.
  const columnas = {
    liquidacionOficialId: "LiquidacionOficialId",
    sujetoImpuesto: "SujetoImpuesto",
    numeroLiquidacionOficial: "NumeroLiquidacionOficial"
  };

  let ok = 0;
  for (const fila of filas) {
    const numeroLiquidacionOficial = aTexto(fila[columnas.numeroLiquidacionOficial]);
    const sujetoImpuesto = aTexto(fila[columnas.sujetoImpuesto]);
    if (!numeroLiquidacionOficial || !sujetoImpuesto) continue;

    await prisma.liquidacionOficial.upsert({
      where: { numeroLiquidacionOficial },
      update: { sujetoImpuesto, liquidacionOficialId: aTexto(fila[columnas.liquidacionOficialId]) || numeroLiquidacionOficial },
      create: {
        numeroLiquidacionOficial,
        sujetoImpuesto,
        liquidacionOficialId: aTexto(fila[columnas.liquidacionOficialId]) || numeroLiquidacionOficial
      }
    });
    ok++;
  }
  console.log(`✔ Liquidaciones oficiales importadas: ${ok}`);
}

async function importarNotificacionesLiquidaciones() {
  const filas = leerHoja("notificaciones_liquidaciones.xlsx");
  if (!filas) return;

  // 👉 Ajusta estos nombres a los encabezados reales de tu exportación.
  const columnas = {
    numeroLiquidacionOficial: "NumeroLiquidacionOficial",
    numeroNotificacion: "NumeroNotificacion",
    numeroGuia: "NumeroGuia"
  };

  let ok = 0;
  let omitidos = 0;
  for (const fila of filas) {
    const numeroLiquidacionOficial = aTexto(fila[columnas.numeroLiquidacionOficial]);
    const numeroGuia = aTexto(fila[columnas.numeroGuia]);
    if (!numeroLiquidacionOficial || !numeroGuia) continue;

    const liqExiste = await prisma.liquidacionOficial.findUnique({ where: { numeroLiquidacionOficial } });
    if (!liqExiste) {
      omitidos++;
      continue;
    }

    const notificacion = `${numeroLiquidacionOficial}-${numeroGuia}`;
    await prisma.notificacionLiquidacion.upsert({
      where: { notificacion },
      update: { numeroLiquidacionOficial, numeroGuia, numeroNotificacion: aTexto(fila[columnas.numeroNotificacion]) },
      create: {
        notificacion,
        numeroLiquidacionOficial,
        numeroGuia,
        numeroNotificacion: aTexto(fila[columnas.numeroNotificacion])
      }
    });
    ok++;
  }
  console.log(`✔ Notificaciones de liquidaciones importadas: ${ok}${omitidos ? ` (omitidas: ${omitidos})` : ""}`);
}

async function main() {
  console.log("Iniciando importación desde", DATA_DIR);
  await importarExpedientes();
  await importarDocumentos();
  await importarNotificacionesDocumentos();
  await importarLiquidaciones();
  await importarNotificacionesLiquidaciones();
  console.log("Listo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
