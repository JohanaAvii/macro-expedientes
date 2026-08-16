import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sujeto = req.nextUrl.searchParams.get("sujeto")?.trim();
  const numeroLiquidacion = req.nextUrl.searchParams.get("liquidacion")?.trim();

  if (!sujeto && !numeroLiquidacion) {
    return NextResponse.json(
      { error: "Debe ingresar una referencia, sujeto impuesto, número de expediente o liquidación para realizar la consulta." },
      { status: 400 }
    );
  }

  const liquidaciones = await prisma.liquidacionOficial.findMany({
    where: numeroLiquidacion
      ? { numeroLiquidacionOficial: numeroLiquidacion }
      : { sujetoImpuesto: sujeto! },
    select: {
      sujetoImpuesto: true,
      liquidacionOficialId: true,
      numeroLiquidacionOficial: true,
      archivoUrl: true
    },
    orderBy: { numeroLiquidacionOficial: "asc" }
  });

  await prisma.consultaAuditoria.create({
    data: {
      usuario: session.user?.email ?? "desconocido",
      criterio: numeroLiquidacion ?? sujeto ?? "",
      tipo: "LIQUIDACION"
    }
  });

  return NextResponse.json({ data: liquidaciones });
}
