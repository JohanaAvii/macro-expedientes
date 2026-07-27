import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { numero: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const liquidacion = await prisma.liquidacionOficial.findUnique({
    where: { numeroLiquidacionOficial: params.numero },
    select: {
      sujetoImpuesto: true,
      numeroLiquidacionOficial: true,
      notificaciones: {
        select: { numeroNotificacion: true, numeroGuia: true },
        distinct: ["numeroNotificacion", "numeroGuia"]
      }
    }
  });

  if (!liquidacion) return NextResponse.json({ data: [] });

  const data = liquidacion.notificaciones.map((n) => ({
    numeroLiquidacionOficial: liquidacion.numeroLiquidacionOficial,
    sujetoImpuesto: liquidacion.sujetoImpuesto,
    numeroNotificacion: n.numeroNotificacion,
    numeroGuia: n.numeroGuia
  }));

  return NextResponse.json({ data });
}
