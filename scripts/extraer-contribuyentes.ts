/**
 * EXTRAER CONTRIBUYENTES DESDE LOS PDF — sin OCR, leyendo el texto real
 * -------------------------------------------------------------------------
 * Los documentos (Mandamiento de Pago, Citación, Resolución de Embargo, etc.)
 * son generados por sistema, así que su texto se puede leer directo del PDF
 * (no son imágenes escaneadas). Todos comparten, cerca del final, un bloque
 * fijo con esta forma:
 *
 *   ... PROCESO N°: 20136402060 FECHA: ...
 *   TIPO DOCUMENTO  NÚMERO DE IDENTIFICACIÓN  APELLIDOS Y NOMBRE O RAZÓN SOCIAL
 *   C  17.971.669  ELIEGAR JESUS PENALOZA TORRES
 *
 * Este script recorre la misma carpeta local de PDF que ya usamos para
 * subir-pdfs.ts, extrae ese bloque de cada archivo, resuelve a qué
 * SujetoImpuesto corresponde (vía el número de expediente = "PROCESO N°")
 * y llena la tabla Contribuyente automáticamente — sin escribir nada a mano.
 *
 * Cómo correrlo:
 *   npm run extraer:contribuyentes -- "D:\MacroPc\PRESCRIPCIONE\Expedientes a entregar"
 *
 * Es reanudable/seguro de correr varias veces: siempre sobreescribe con el
 * dato más reciente que encuentre para cada SujetoImpuesto, no duplica nada.
 */

import fs from "fs";
import path from "path";
// @ts-ignore -- pdf-parse no trae tipos oficiales
import pdfParse from "pdf-parse";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REGEX_PROCESO = /PROCESO N[°ºo]?\.?:?\s*(\d+)/i;
// En el texto real extraído del PDF, las celdas de la tabla quedan pegadas
// sin espacio: "C1.065.599.686PABLO EMILIO RIVAS MACHADO" en vez de
// "C 1.065.599.686 PABLO EMILIO RIVAS MACHADO" — por eso el patrón no lleva
// espacios entre el tipo de documento, la identificación y el nombre.
const REGEX_CONTRIBUYENTE = /^([A-Z]{1,3})([\d][\d.,]{3,})([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \-]+)$/gim;

function limpiarIdentificacion(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

async function conReintento<T>(fn: () => Promise<T>, intentos = 3, esperaMs = 1000): Promise<T> {
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
    console.error('Uso: npx tsx scripts/extraer-contribuyentes.ts "RUTA\\A\\Expedientes a entregar"');
    process.exit(1);
  }
  if (!fs.existsSync(carpetaRaiz)) {
    console.error("No existe la ruta:", carpetaRaiz);
    process.exit(1);
  }

  console.log("Cargando en memoria los expedientes (numeroExpediente → sujetoImpuesto)…");
  const expedientes = await conReintento(() =>
    prisma.expediente.findMany({ select: { numeroExpediente: true, sujetoImpuesto: true } })
  );
  const mapaExpedientes = new Map(expedientes.map((e) => [e.numeroExpediente, e.sujetoImpuesto]));
  console.log(`Expedientes en memoria: ${mapaExpedientes.size}\n`);

  const carpetas = fs.readdirSync(carpetaRaiz, { withFileTypes: true }).filter((d) => d.isDirectory());
  console.log(`Encontradas ${carpetas.length} carpetas de expediente en ${carpetaRaiz}`);

  const contribuyentesPorSujeto = new Map<string, { nombre: string; identificacion: string }>();

  let procesados = 0;
  let conTexto = 0;
  let sinPatron = 0;
  let sinExpedienteEnBd = 0;
  let errores = 0;

  for (const carpeta of carpetas) {
    const rutaCarpeta = path.join(carpetaRaiz, carpeta.name);
    let archivos: string[] = [];
    try {
      archivos = fs.readdirSync(rutaCarpeta).filter((f) => f.toLowerCase().endsWith(".pdf"));
    } catch {
      continue;
    }

    for (const archivo of archivos) {
      procesados++;
      try {
        const buffer = fs.readFileSync(path.join(rutaCarpeta, archivo));
        const data = await pdfParse(buffer);
        const texto: string = data.text || "";

        const procesoMatch = texto.match(REGEX_PROCESO);
        const coincidencias = [...texto.matchAll(REGEX_CONTRIBUYENTE)];

        if (!procesoMatch || coincidencias.length === 0) {
          sinPatron++;
          continue;
        }
        conTexto++;

        const numeroExpediente = procesoMatch[1];
        const sujetoImpuesto = mapaExpedientes.get(numeroExpediente);
        if (!sujetoImpuesto) {
          sinExpedienteEnBd++;
          continue;
        }

        // Tomamos la última coincidencia: es la del bloque final, más limpia
        // (la primera puede venir revuelta con las tablas del encabezado).
        const [, , idCruda, nombreCrudo] = coincidencias[coincidencias.length - 1];
        const identificacion = limpiarIdentificacion(idCruda);
        const nombre = nombreCrudo.trim().replace(/\s{2,}/g, " ");

        if (identificacion && nombre) {
          contribuyentesPorSujeto.set(sujetoImpuesto, { nombre, identificacion });
        }
      } catch {
        errores++;
      }

      if (procesados % 2000 === 0) {
        console.log(`  … PDF procesados: ${procesados} (contribuyentes únicos hasta ahora: ${contribuyentesPorSujeto.size})`);
      }
    }
  }

  console.log("\nExtracción de texto terminada:");
  console.log(`  PDF procesados:                 ${procesados}`);
  console.log(`  Con el patrón reconocido:       ${conTexto}`);
  console.log(`  Sin patrón (formato distinto):  ${sinPatron}`);
  console.log(`  Con expediente no encontrado:   ${sinExpedienteEnBd}`);
  console.log(`  Errores al leer el PDF:         ${errores}`);
  console.log(`  Contribuyentes únicos a guardar:${contribuyentesPorSujeto.size}`);

  const entradas = [...contribuyentesPorSujeto.entries()];
  const TAMANO_LOTE = 300;
  let guardados = 0;
  for (let i = 0; i < entradas.length; i += TAMANO_LOTE) {
    const lote = entradas.slice(i, i + TAMANO_LOTE);
    await Promise.all(
      lote.map(([sujetoImpuesto, { nombre, identificacion }]) =>
        conReintento(() =>
          prisma.contribuyente.upsert({
            where: { sujetoImpuesto },
            update: { nombre, identificacion },
            create: { sujetoImpuesto, nombre, identificacion }
          })
        ).catch(() => {})
      )
    );
    guardados += lote.length;
    console.log(`  … guardados ${guardados} / ${entradas.length}`);
  }

  console.log("\n✔ Listo. La búsqueda por nombre/identificación ya puede usarse en la app.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());