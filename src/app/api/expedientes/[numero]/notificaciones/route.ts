import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { numero: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // 11.8: solo aparecen documentos que sí tienen notificación/guía asociada.
  // 11.9: unicidad por DocumentoExpedienteId + NumeroGuia + EstadoEnvio + SujetoImpuesto.
  const documentos = await prisma.documentoExpediente.findMany({
    where: { numeroExpediente: params.numero },
    select: {
      documentoExpedienteId: true,
      nombre: true,
      sujetoImpuesto: true,
      archivoUrl: true,
      notificaciones: {
        select: { numeroGuia: true, estadoEnvio: true },
        distinct: ["numeroGuia", "estadoEnvio"]
      }
    },
    orderBy: { documentoExpedienteId: "asc" }
  });

  const data = documentos.flatMap((d) =>
    d.notificaciones.map((n) => ({
      documentoExpedienteId: d.documentoExpedienteId,
      nombre: d.nombre,
      sujetoImpuesto: d.sujetoImpuesto,
      numeroGuia: n.numeroGuia,
      estadoEnvio: n.estadoEnvio,
      archivoUrl: d.archivoUrl
    }))
  );

  return NextResponse.json({ data });
}
