/**
 * IMPORTADOR DE DATOS — desde exportaciones de Access hacia PostgreSQL
 * ---------------------------------------------------------------------
 * Ya ajustado a las columnas reales de tu exportación de Access. Si vuelves
 * a exportar y los nombres de columna cambian, ajusta los objetos `columnas`
 * de cada función más abajo (marcados con 👉).
 *
 * Carga por LOTES (no fila por fila) porque los volúmenes son grandes:
 * documento_expediente (~250k filas), notificaciones_liquidaciones (~540k).
 * Cada tabla se inserta en bloques de 2000 registros con `createMany` +
 * `skipDuplicates`, y las relaciones (expediente, documento, liquidación)
 * se validan en memoria contra un set ya cargado, no con una consulta por fila.
 *
 * Cómo correrlo (usa el DATABASE_URL de tu .env):
 *   npm run importar:datos
 */

import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");
const TAMANO_LOTE = 2000;

// Convierte cualquier valor leído del Excel a texto, conservando ceros
// iniciales (regla 11.1). Nunca lo tratamos como número.
function aTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

// Access agrega un BOM invisible al primer encabezado de cada hoja al
// exportar a Excel (se ve como "\ufeffSujetoImpuesto"). Lo limpiamos aquí
// para que los nombres de columna coincidan con lo que escribimos abajo.
function limpiarEncabezados(filas: Record<string, unknown>[]) {
  return filas.map((fila) => {
    const limpia: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(fila)) {
      limpia[clave.replace(/^\uFEFF/, "").trim()] = valor;
    }
    return limpia;
  });
}

function leerHoja(nombreArchivo: string) {
  const ruta = path.join(DATA_DIR, nombreArchivo);
  if (!fs.existsSync(ruta)) {
    console.warn(`⚠ No se encontró ${ruta} — se omite este archivo.`);
    return null;
  }
  const libro = XLSX.readFile(ruta, { raw: false });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "", raw: false });
  return limpiarEncabezados(filas);
}

// Inserta en lotes. Si un lote entero falla (choque de llave única en un
// campo distinto al usado para deduplicar), reintenta ese lote fila por
// fila para no perder el resto de los datos buenos.
async function insertarEnLotes<T>(
  nombre: string,
  datos: T[],
  crearLote: (lote: T[]) => Promise<unknown>,
  crearUno: (item: T) => Promise<unknown>
) {
  let ok = 0;
  let errores = 0;
  for (let i = 0; i < datos.length; i += TAMANO_LOTE) {
    const lote = datos.slice(i, i + TAMANO_LOTE);
    try {
      await crearLote(lote);
      ok += lote.length;
    } catch {
      for (const item of lote) {
        try {
          await crearUno(item);
          ok++;
        } catch {
          errores++;
        }
      }
    }
    if ((i / TAMANO_LOTE) % 10 === 0) {
      console.log(`  … ${nombre}: ${Math.min(i + TAMANO_LOTE, datos.length)} / ${datos.length}`);
    }
  }
  console.log(`✔ ${nombre}: ${ok} insertados${errores ? ` (${errores} con error, omitidos)` : ""}`);
}

// Quita filas repetidas quedándose con la última ocurrencia de cada llave
// (createMany no acepta llaves duplicadas dentro del mismo lote).
function deduplicar<T>(filas: T[], llave: (item: T) => string): T[] {
  const mapa = new Map<string, T>();
  for (const fila of filas) {
    const k = llave(fila);
    if (k) mapa.set(k, fila);
  }
  return [...mapa.values()];
}

async function importarExpedientes() {
  const filas = leerHoja("expedientes.xlsx");
  if (!filas) return;

  // 👉 Columnas reales: Id, SujetoImpuesto, NumeroExpediente
  const columnas = { sujetoImpuesto: "SujetoImpuesto", numeroExpediente: "NumeroExpediente" };

  const datos = deduplicar(
    filas
      .map((f) => ({
        numeroExpediente: aTexto(f[columnas.numeroExpediente]),
        sujetoImpuesto: aTexto(f[columnas.sujetoImpuesto])
      }))
      .filter((d) => d.numeroExpediente && d.sujetoImpuesto),
    (d) => d.numeroExpediente
  );

  await insertarEnLotes(
    "Expedientes",
    datos,
    (lote) => prisma.expediente.createMany({ data: lote, skipDuplicates: true }),
    (item) => prisma.expediente.upsert({ where: { numeroExpediente: item.numeroExpediente }, update: item, create: item })
  );
}

async function importarDocumentos() {
  const filas = leerHoja("documento_expediente.xlsx");
  if (!filas) return;

  // 👉 Columnas reales: Id, DocumentoExpedienteId, ActividadExpedienteId,
  //    NumeroDocumento, TipoDocumentoId, Nombre, Estado, FechaDocumento,
  //    SujetoImpuesto, NumeroExpediente
  const columnas = {
    documentoExpedienteId: "DocumentoExpedienteId",
    numeroExpediente: "NumeroExpediente",
    sujetoImpuesto: "SujetoImpuesto",
    numeroDocumento: "NumeroDocumento",
    nombre: "Nombre",
    estado: "Estado",
    actividadExp: "ActividadExpedienteId"
  };

  // Cargamos en memoria los expedientes ya existentes (deben insertarse
  // primero) para filtrar sin hacer una consulta por cada una de las
  // ~250.000 filas.
  const expedientesExistentes = new Set(
    (await prisma.expediente.findMany({ select: { numeroExpediente: true } })).map((e) => e.numeroExpediente)
  );

  let sinExpediente = 0;
  const datos = deduplicar(
    filas
      .map((f) => ({
        documentoExpedienteId: aTexto(f[columnas.documentoExpedienteId]),
        numeroExpediente: aTexto(f[columnas.numeroExpediente]),
        sujetoImpuesto: aTexto(f[columnas.sujetoImpuesto]),
        numeroDocumento: aTexto(f[columnas.numeroDocumento]),
        nombre: aTexto(f[columnas.nombre]) || "Documento sin nombre",
        estado: aTexto(f[columnas.estado]) || null,
        actividadExp: aTexto(f[columnas.actividadExp]) || null
      }))
      .filter((d) => {
        if (!d.documentoExpedienteId || !d.numeroExpediente) return false;
        if (!expedientesExistentes.has(d.numeroExpediente)) {
          sinExpediente++;
          return false;
        }
        return true;
      }),
    (d) => d.documentoExpedienteId
  );

  if (sinExpediente) console.warn(`⚠ ${sinExpediente} documentos omitidos por no tener expediente asociado.`);

  await insertarEnLotes(
    "Documentos",
    datos,
    (lote) => prisma.documentoExpediente.createMany({ data: lote, skipDuplicates: true }),
    (item) =>
      prisma.documentoExpediente.upsert({
        where: { documentoExpedienteId: item.documentoExpedienteId },
        update: item,
        create: item
      })
  );
}

async function importarNotificacionesDocumentos() {
  const filas = leerHoja("notificaciones_documentos.xlsx");
  if (!filas) return;

  // 👉 Columnas reales: Id, NotificacionesDocumentoId, DocumentoExpedienteId,
  //    NumeroGuia, EstadoEnvio
  const columnas = {
    notificacion: "NotificacionesDocumentoId",
    documentoExpedienteId: "DocumentoExpedienteId",
    numeroGuia: "NumeroGuia",
    estadoEnvio: "EstadoEnvio"
  };

  const documentosExistentes = new Set(
    (await prisma.documentoExpediente.findMany({ select: { documentoExpedienteId: true } })).map(
      (d) => d.documentoExpedienteId
    )
  );

  let sinDocumento = 0;
  const datos = deduplicar(
    filas
      .map((f) => ({
        notificacion: aTexto(f[columnas.notificacion]),
        documentoExpedienteId: aTexto(f[columnas.documentoExpedienteId]),
        numeroGuia: aTexto(f[columnas.numeroGuia]),
        estadoEnvio: aTexto(f[columnas.estadoEnvio]).toUpperCase()
      }))
      .filter((d) => {
        if (!d.notificacion || !d.documentoExpedienteId || !d.numeroGuia) return false;
        if (!documentosExistentes.has(d.documentoExpedienteId)) {
          sinDocumento++;
          return false;
        }
        return true;
      }),
    (d) => d.notificacion
  );

  if (sinDocumento) console.warn(`⚠ ${sinDocumento} notificaciones omitidas por no tener documento asociado.`);

  await insertarEnLotes(
    "Notificaciones de documentos",
    datos,
    (lote) => prisma.notificacionDocumento.createMany({ data: lote, skipDuplicates: true }),
    (item) =>
      prisma.notificacionDocumento.upsert({ where: { notificacion: item.notificacion }, update: item, create: item })
  );
}

async function importarLiquidaciones() {
  const filas = leerHoja("liquidaciones_oficiales.xlsx");
  if (!filas) return;

  // 👉 Columnas reales: Id, LiquidacionOficialId, NumeroLiquidacionOficial, SujetoImpuesto
  const columnas = {
    liquidacionOficialId: "LiquidacionOficialId",
    sujetoImpuesto: "SujetoImpuesto",
    numeroLiquidacionOficial: "NumeroLiquidacionOficial"
  };

  const datos = deduplicar(
    filas
      .map((f) => ({
        numeroLiquidacionOficial: aTexto(f[columnas.numeroLiquidacionOficial]),
        sujetoImpuesto: aTexto(f[columnas.sujetoImpuesto]),
        liquidacionOficialId: aTexto(f[columnas.liquidacionOficialId])
      }))
      .filter((d) => d.numeroLiquidacionOficial && d.sujetoImpuesto && d.liquidacionOficialId),
    (d) => d.numeroLiquidacionOficial
  );

  await insertarEnLotes(
    "Liquidaciones oficiales",
    datos,
    (lote) => prisma.liquidacionOficial.createMany({ data: lote, skipDuplicates: true }),
    (item) =>
      prisma.liquidacionOficial.upsert({
        where: { numeroLiquidacionOficial: item.numeroLiquidacionOficial },
        update: item,
        create: item
      })
  );
}

async function importarNotificacionesLiquidaciones() {
  const filas = leerHoja("notificaciones_liquidaciones.xlsx");
  if (!filas) return;

  // 👉 Columnas reales: Id, NotificacionesPredialID, NumeroNotificacion,
  //    NumeroGuia, NumeroLiquidacionOficial
  const columnas = {
    notificacion: "NotificacionesPredialID",
    numeroLiquidacionOficial: "NumeroLiquidacionOficial",
    numeroNotificacion: "NumeroNotificacion",
    numeroGuia: "NumeroGuia"
  };

  const liquidacionesExistentes = new Set(
    (await prisma.liquidacionOficial.findMany({ select: { numeroLiquidacionOficial: true } })).map(
      (l) => l.numeroLiquidacionOficial
    )
  );

  let sinLiquidacion = 0;
  const datos = deduplicar(
    filas
      .map((f) => ({
        notificacion: aTexto(f[columnas.notificacion]),
        numeroLiquidacionOficial: aTexto(f[columnas.numeroLiquidacionOficial]),
        numeroNotificacion: aTexto(f[columnas.numeroNotificacion]),
        numeroGuia: aTexto(f[columnas.numeroGuia])
      }))
      .filter((d) => {
        if (!d.notificacion || !d.numeroLiquidacionOficial || !d.numeroGuia) return false;
        if (!liquidacionesExistentes.has(d.numeroLiquidacionOficial)) {
          sinLiquidacion++;
          return false;
        }
        return true;
      }),
    (d) => d.notificacion
  );

  if (sinLiquidacion) console.warn(`⚠ ${sinLiquidacion} notificaciones omitidas por no tener liquidación asociada.`);

  await insertarEnLotes(
    "Notificaciones de liquidaciones",
    datos,
    (lote) => prisma.notificacionLiquidacion.createMany({ data: lote, skipDuplicates: true }),
    (item) =>
      prisma.notificacionLiquidacion.upsert({ where: { notificacion: item.notificacion }, update: item, create: item })
  );
}

async function main() {
  console.log("Iniciando importación desde", DATA_DIR);
  console.log("(los volúmenes grandes pueden tardar varios minutos, es normal)\n");
  await importarExpedientes();
  await importarDocumentos();
  await importarNotificacionesDocumentos();
  await importarLiquidaciones();
  await importarNotificacionesLiquidaciones();
  console.log("\nListo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());