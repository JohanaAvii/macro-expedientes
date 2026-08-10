/**
 * LIMPIAR ENLACES ROTOS — para cuando un store de Blob se eliminó/cambió
 * -------------------------------------------------------------------------
 * Durante la configuración probamos varios stores de Vercel Blob (uno
 * privado que hubo que borrar, uno público que llegó al límite del plan
 * gratis, y finalmente uno en la cuenta Pro). Los documentos que se
 * subieron a un store que ya no existe quedaron con un `archivoUrl`
 * guardado que apunta a un lugar roto ("Store not found").
 *
 * Este script busca esos enlaces rotos (cualquier archivoUrl que NO
 * empiece con la URL base del store bueno/actual) y los deja en null,
 * para que `npm run importar:pdfs` los vuelva a subir en la próxima
 * corrida (es reanudable, así que solo re-sube estos, no los que ya
 * están bien).
 *
 * Cómo correrlo (usa la Base URL real de tu store actual en Storage → Settings):
 *   npx tsx scripts/limpiar-urls-viejas.ts "https://arc9j4hd2xdcmett.public.blob.vercel-storage.com"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const urlBaseBuena = process.argv[2];
  if (!urlBaseBuena) {
    console.error('Uso: npx tsx scripts/limpiar-urls-viejas.ts "https://TU-STORE-ACTUAL.public.blob.vercel-storage.com"');
    process.exit(1);
  }

  const documentos = await prisma.documentoExpediente.findMany({
    where: { archivoUrl: { not: null } },
    select: { documentoExpedienteId: true, archivoUrl: true }
  });

  const rotos = documentos.filter((d) => d.archivoUrl && !d.archivoUrl.startsWith(urlBaseBuena));

  console.log(`Documentos con archivo:        ${documentos.length}`);
  console.log(`Apuntando al store actual:     ${documentos.length - rotos.length}`);
  console.log(`Con enlace roto (a limpiar):   ${rotos.length}`);

  if (rotos.length === 0) {
    console.log("\nNada que limpiar — todos los enlaces ya apuntan al store actual.");
    return;
  }

  const TAMANO_LOTE = 500;
  let limpiados = 0;
  for (let i = 0; i < rotos.length; i += TAMANO_LOTE) {
    const lote = rotos.slice(i, i + TAMANO_LOTE);
    await prisma.documentoExpediente.updateMany({
      where: { documentoExpedienteId: { in: lote.map((d) => d.documentoExpedienteId) } },
      data: { archivoUrl: null, archivoNombreOriginal: null }
    });
    limpiados += lote.length;
    console.log(`  … limpiados ${limpiados} / ${rotos.length}`);
  }

  console.log(`\n✔ Listo. ${limpiados} documentos quedaron sin archivo — se re-subirán en la próxima corrida de importar:pdfs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
