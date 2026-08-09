import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { numero: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const documentos = await prisma.documentoExpediente.findMany({
    where: { numeroExpediente: params.numero },
    select: {
      numeroExpediente: true,
      sujetoImpuesto: true,
      documentoExpedienteId: true,
      nombre: true,
      numeroDocumento: true,
      archivoUrl: true
    },
    orderBy: { documentoExpedienteId: "asc" }
  });

  return NextResponse.json({ data: documentos });
}
