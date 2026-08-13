"use client";

type Columna<T> = {
  header: string;
  valor: (fila: T) => string;
  /** Fuerza que Excel lo trate como texto (no numérico) — conserva ceros iniciales. */
  comoTexto?: boolean;
};

function escaparCeldaTexto(valor: string): string {
  const v = (valor ?? "").replace(/"/g, '""');
  return /[",\n;]/.test(v) ? `"${v}"` : v;
}

function celdaComoTexto(valor: string): string {
  // El truco =""valor"" hace que Excel muestre el contenido tal cual,
  // sin convertirlo a número ni recortar ceros iniciales.
  const v = (valor ?? "").replace(/"/g, '""');
  return `"=""${v}"""`;
}

export function descargarCSV<T>(nombreArchivo: string, columnas: Columna<T>[], filas: T[]) {
  const encabezado = columnas.map((c) => escaparCeldaTexto(c.header)).join(";");
  const cuerpo = filas
    .map((fila) =>
      columnas
        .map((c) => {
          const valor = c.valor(fila) ?? "";
          return c.comoTexto ? celdaComoTexto(valor) : escaparCeldaTexto(valor);
        })
        .join(";")
    )
    .join("\r\n");

  // BOM al inicio para que Excel reconozca acentos/ñ correctamente.
  const contenido = "\uFEFF" + encabezado + "\r\n" + cuerpo;
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
