import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sujeto = req.nextUrl.searchParams.get("sujeto")?.trim();
  const numeroExpediente = req.nextUrl.searchParams.get("expediente")?.trim();

  // 14.1 Validación de entrada obligatoria
  if (!sujeto && !numeroExpediente) {
    return NextResponse.json(
      { error: "Debe ingresar una referencia, sujeto impuesto, número de expediente o liquidación para realizar la consulta." },
      { status: 400 }
    );
  }

  const expedientes = await prisma.expediente.findMany({
    where: numeroExpediente
      ? { numeroExpediente }
      : { sujetoImpuesto: sujeto! },
    select: { numeroExpediente: true, sujetoImpuesto: true },
    orderBy: { numeroExpediente: "asc" }
  });

  await prisma.consultaAuditoria.create({
    data: {
      usuario: session.user?.email ?? "desconocido",
      criterio: numeroExpediente ?? sujeto ?? "",
      tipo: "EXPEDIENTE"
    }
  });

  return NextResponse.json({ data: expedientes });
}
