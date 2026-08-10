import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/contribuyentes?buscar=texto           → búsqueda parcial por nombre/identificación
// GET /api/contribuyentes?sujetoImpuesto=exacto   → lookup puntual de un contribuyente ya conocido
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sujetoImpuesto = req.nextUrl.searchParams.get("sujetoImpuesto")?.trim();
  if (sujetoImpuesto) {
    const contribuyente = await prisma.contribuyente.findUnique({
      where: { sujetoImpuesto },
      select: { sujetoImpuesto: true, nombre: true, identificacion: true }
    });
    return NextResponse.json({ data: contribuyente ? [contribuyente] : [] });
  }

  const buscar = req.nextUrl.searchParams.get("buscar")?.trim();
  if (!buscar) {
    return NextResponse.json({ error: "Ingrese un nombre o número de identificación para buscar." }, { status: 400 });
  }

  const resultados = await prisma.contribuyente.findMany({
    where: {
      OR: [{ nombre: { contains: buscar, mode: "insensitive" } }, { identificacion: { contains: buscar } }]
    },
    select: { sujetoImpuesto: true, nombre: true, identificacion: true },
    take: 25,
    orderBy: { nombre: "asc" }
  });

  return NextResponse.json({ data: resultados });
}

// POST /api/contribuyentes  { sujetoImpuesto, nombre, identificacion }
// Registra o actualiza el nombre/identificación de un contribuyente.
// Cualquier usuario autenticado puede completarlo — así el directorio se
// va construyendo con el uso diario, sin depender de una carga inicial.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const sujetoImpuesto = typeof body?.sujetoImpuesto === "string" ? body.sujetoImpuesto.trim() : "";
  const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
  const identificacion = typeof body?.identificacion === "string" ? body.identificacion.trim() : "";

  if (!sujetoImpuesto || (!nombre && !identificacion)) {
    return NextResponse.json(
      { error: "Debe indicar el sujeto impuesto y al menos el nombre o la identificación." },
      { status: 400 }
    );
  }

  const contribuyente = await prisma.contribuyente.upsert({
    where: { sujetoImpuesto },
    update: { nombre: nombre || undefined, identificacion: identificacion || undefined },
    create: { sujetoImpuesto, nombre: nombre || null, identificacion: identificacion || null }
  });

  return NextResponse.json({ data: contribuyente });
}
