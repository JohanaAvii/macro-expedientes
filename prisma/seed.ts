import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---------- Usuario de acceso ----------
  const passwordHash = await bcrypt.hash("Valledupar2026*", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      nombre: "Joel García",
      rol: "ADMIN"
    }
  });

  // ---------- Catálogos ----------
  await prisma.tipoDocumento.createMany({
    data: [
      { codigo: "MP", nombre: "Mandamiento de pago", abreviatura: "MP" },
      { codigo: "CP", nombre: "Citación personal", abreviatura: "CP" },
      { codigo: "RE", nombre: "Resolución de embargo", abreviatura: "RE" },
      { codigo: "DF", nombre: "Desembargo financiero", abreviatura: "DF" },
      { codigo: "AT", nombre: "Auto de terminación", abreviatura: "AT" }
    ],
    skipDuplicates: true
  });

  await prisma.empresaMensajeria.createMany({
    data: [{ codigo: "472", descripcion: "Servicios Postales Nacionales" }],
    skipDuplicates: true
  });

  // ---------- Caso funcional validado (sección 18 del requerimiento) ----------
  await prisma.expediente.upsert({
    where: { numeroExpediente: "20166420005" },
    update: {},
    create: { sujetoImpuesto: "010205210054001", numeroExpediente: "20166420005" }
  });

  const documentos = [
    { id: "244", nombre: "MANDAMIENTO DE PAGO", numero: "2018730000014" },
    { id: "245", nombre: "Citación Personal", numero: "2018731000015" },
    { id: "246", nombre: "RESOLUCIÓN DE EMBARGO CUENTAS BANCARIAS", numero: "20163006814" },
    { id: "27125", nombre: "Citación Personal", numero: "2018710026355" },
    { id: "222034", nombre: "DESEMBARGO FINANCIERO", numero: "2019960008950" },
    { id: "240449", nombre: "AUTO DE TERMINACIÓN", numero: "2019860012875" }
  ];

  for (const d of documentos) {
    await prisma.documentoExpediente.upsert({
      where: { documentoExpedienteId: d.id },
      update: {},
      create: {
        documentoExpedienteId: d.id,
        numeroExpediente: "20166420005",
        sujetoImpuesto: "010205210054001",
        numeroDocumento: d.numero,
        nombre: d.nombre
      }
    });
  }

  await prisma.notificacionDocumento.upsert({
    where: { notificacion: "N-244" },
    update: {},
    create: { notificacion: "N-244", documentoExpedienteId: "244", numeroGuia: "1030199892", estadoEnvio: "DEVUELTO" }
  });
  await prisma.notificacionDocumento.upsert({
    where: { notificacion: "N-245" },
    update: {},
    create: { notificacion: "N-245", documentoExpedienteId: "245", numeroGuia: "1030200011", estadoEnvio: "ENTREGADO" }
  });
  await prisma.notificacionDocumento.upsert({
    where: { notificacion: "N-27125" },
    update: {},
    create: { notificacion: "N-27125", documentoExpedienteId: "27125", numeroGuia: "10572148359", estadoEnvio: "DEVUELTO" }
  });

  // ---------- Un segundo sujeto con expedientes / liquidaciones para probar filtros ----------
  await prisma.expediente.upsert({
    where: { numeroExpediente: "20177710012" },
    update: {},
    create: { sujetoImpuesto: "020103450012000", numeroExpediente: "20177710012" }
  });
  await prisma.expediente.upsert({
    where: { numeroExpediente: "20177710099" },
    update: {},
    create: { sujetoImpuesto: "020103450012000", numeroExpediente: "20177710099" }
  });
  await prisma.documentoExpediente.upsert({
    where: { documentoExpedienteId: "310022" },
    update: {},
    create: {
      documentoExpedienteId: "310022",
      numeroExpediente: "20177710012",
      sujetoImpuesto: "020103450012000",
      numeroDocumento: "2020730000091",
      nombre: "MANDAMIENTO DE PAGO"
    }
  });

  // ---------- Liquidaciones oficiales ----------
  await prisma.liquidacionOficial.upsert({
    where: { numeroLiquidacionOficial: "900123456" },
    update: {},
    create: { liquidacionOficialId: "L-0001", sujetoImpuesto: "010205210054001", numeroLiquidacionOficial: "900123456" }
  });
  await prisma.liquidacionOficial.upsert({
    where: { numeroLiquidacionOficial: "900123999" },
    update: {},
    create: { liquidacionOficialId: "L-0002", sujetoImpuesto: "020103450012000", numeroLiquidacionOficial: "900123999" }
  });
  await prisma.liquidacionOficial.upsert({
    where: { numeroLiquidacionOficial: "900124500" },
    update: {},
    create: { liquidacionOficialId: "L-0003", sujetoImpuesto: "020103450012000", numeroLiquidacionOficial: "900124500" }
  });

  await prisma.notificacionLiquidacion.upsert({
    where: { notificacion: "NL-900123456" },
    update: {},
    create: {
      notificacion: "NL-900123456",
      numeroNotificacion: "N-004521",
      numeroGuia: "1030555222",
      numeroLiquidacionOficial: "900123456"
    }
  });
  await prisma.notificacionLiquidacion.upsert({
    where: { notificacion: "NL-900124500" },
    update: {},
    create: {
      notificacion: "NL-900124500",
      numeroNotificacion: "N-004988",
      numeroGuia: "1030555980",
      numeroLiquidacionOficial: "900124500"
    }
  });

  console.log("Seed completado. Usuario: admin / Contraseña: Valledupar2026*");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
