"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AZUL_MARINO: [number, number, number] = [15, 42, 74]; // #0F2A4A
const AZUL_MEDIO: [number, number, number] = [31, 92, 153]; // #1F5C99
const GRIS_TEXTO: [number, number, number] = [75, 88, 79]; // --ink-soft

let escudoBase64Cache: string | null = null;

async function obtenerEscudoBase64(): Promise<string | null> {
  if (escudoBase64Cache) return escudoBase64Cache;
  try {
    const res = await fetch("/images/escudo-valledupar.png");
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    escudoBase64Cache = base64;
    return base64;
  } catch {
    return null; // si no carga el escudo, igual generamos el PDF sin él
  }
}

function formatearFecha(fecha: Date) {
  return fecha.toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short"
  });
}

async function encabezado(doc: jsPDF, titulo: string, usuario: string, criterio: string) {
  const escudo = await obtenerEscudoBase64();
  if (escudo) {
    try {
      doc.addImage(escudo, "PNG", 14, 10, 26, 13.15);
    } catch {
      // si el formato no es compatible, seguimos sin el escudo
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...AZUL_MARINO);
  doc.text("ALCALDÍA DE VALLEDUPAR", 45, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text("Secretaría de Hacienda · Macro de Expedientes", 45, 21);

  doc.setDrawColor(...AZUL_MARINO);
  doc.setLineWidth(0.8);
  doc.line(14, 28, 196, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...AZUL_MARINO);
  doc.text(titulo, 14, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(`Fecha y hora de generación: ${formatearFecha(new Date())}`, 14, 45);
  doc.text(`Consultado por: ${usuario}`, 14, 50);
  doc.text(`Criterio de búsqueda: ${criterio}`, 14, 55);

  return 63; // siguiente Y disponible
}

function pieDePagina(doc: jsPDF) {
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    const alto = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, alto - 18, 196, alto - 18);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(
      "Este documento certifica que la consulta se realizó en el sistema Macro de Expedientes. No reemplaza los documentos oficiales del expediente.",
      14,
      alto - 13,
      { maxWidth: 182 }
    );
    doc.text(`Página ${i} de ${paginas}`, 196, alto - 13, { align: "right" });
  }
}

function estiloTabla() {
  return {
    theme: "grid" as const,
    headStyles: { fillColor: AZUL_MARINO, textColor: 255, fontSize: 8.5, fontStyle: "bold" as const },
    bodyStyles: { fontSize: 8, textColor: [20, 30, 25] as [number, number, number] },
    alternateRowStyles: { fillColor: [247, 247, 245] as [number, number, number] },
    margin: { left: 14, right: 14 }
  };
}

export async function generarConstanciaExpedientes(datos: {
  usuario: string;
  criterio: string;
  expedientes: { numeroExpediente: string; sujetoImpuesto: string }[];
  documentos: { documentoExpedienteId: string; nombre: string; numeroDocumento: string; archivoUrl: string | null }[] | null;
  notificaciones: { documentoExpedienteId: string; nombre: string; numeroGuia: string; estadoEnvio: string }[] | null;
}) {
  const doc = new jsPDF();
  let y = await encabezado(doc, "Constancia de Consulta · Expedientes", datos.usuario, datos.criterio);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...AZUL_MEDIO);
  doc.text(`Expedientes encontrados (${datos.expedientes.length})`, 14, y);
  y += 4;

  if (datos.expedientes.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text("No se encontraron registros asociados al criterio de búsqueda ingresado.", 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["N.º de expediente", "Sujeto impuesto"]],
      body: datos.expedientes.map((e) => [e.numeroExpediente, e.sujetoImpuesto]),
      ...estiloTabla()
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (datos.documentos !== null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...AZUL_MEDIO);
    doc.text(`Documentos del expediente (${datos.documentos.length})`, 14, y);
    y += 4;

    if (datos.documentos.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS_TEXTO);
      doc.text("Este expediente no tiene documentos asociados.", 14, y + 4);
      y += 12;
    } else {
      autoTable(doc, {
        startY: y,
        head: [["ID documento", "Nombre", "N.º documento", "Archivo"]],
        body: datos.documentos.map((d) => [
          d.documentoExpedienteId,
          d.nombre,
          d.numeroDocumento,
          d.archivoUrl ? "Cargado" : "No cargado"
        ]),
        ...estiloTabla()
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  if (datos.notificaciones !== null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...AZUL_MEDIO);
    doc.text(`Notificaciones del expediente (${datos.notificaciones.length})`, 14, y);
    y += 4;

    if (datos.notificaciones.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS_TEXTO);
      doc.text("Ninguno de los documentos tiene guía o notificación asociada.", 14, y + 4);
    } else {
      autoTable(doc, {
        startY: y,
        head: [["ID documento", "Nombre", "N.º de guía", "Estado de envío"]],
        body: datos.notificaciones.map((n) => [n.documentoExpedienteId, n.nombre, n.numeroGuia, n.estadoEnvio]),
        ...estiloTabla()
      });
    }
  }

  pieDePagina(doc);
  doc.save(`constancia-expediente-${Date.now()}.pdf`);
}

export async function generarConstanciaLiquidaciones(datos: {
  usuario: string;
  criterio: string;
  liquidaciones: { sujetoImpuesto: string; liquidacionOficialId: string; numeroLiquidacionOficial: string }[];
  notificaciones: { numeroNotificacion: string; numeroGuia: string }[] | null;
}) {
  const doc = new jsPDF();
  let y = await encabezado(doc, "Constancia de Consulta · Liquidaciones", datos.usuario, datos.criterio);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...AZUL_MEDIO);
  doc.text(`Liquidaciones oficiales encontradas (${datos.liquidaciones.length})`, 14, y);
  y += 4;

  if (datos.liquidaciones.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS_TEXTO);
    doc.text("No se encontraron registros asociados al criterio de búsqueda ingresado.", 14, y + 4);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Sujeto impuesto", "ID liquidación oficial", "N.º liquidación oficial"]],
      body: datos.liquidaciones.map((l) => [l.sujetoImpuesto, l.liquidacionOficialId, l.numeroLiquidacionOficial]),
      ...estiloTabla()
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (datos.notificaciones !== null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...AZUL_MEDIO);
    doc.text(`Notificaciones de la liquidación (${datos.notificaciones.length})`, 14, y);
    y += 4;

    if (datos.notificaciones.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRIS_TEXTO);
      doc.text("Esta liquidación no tiene notificación o guía asociada.", 14, y + 4);
    } else {
      autoTable(doc, {
        startY: y,
        head: [["N.º notificación", "N.º de guía"]],
        body: datos.notificaciones.map((n) => [n.numeroNotificacion, n.numeroGuia]),
        ...estiloTabla()
      });
    }
  }

  pieDePagina(doc);
  doc.save(`constancia-liquidacion-${Date.now()}.pdf`);
}
