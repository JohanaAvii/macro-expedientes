"use client";

import { useEffect, useState } from "react";

export type TipoVistaPrevia = "imagen" | "pdf" | "auto";

function pareceImagen(url: string) {
  return /\.(jpg|jpeg|png|gif|bmp|tiff?)(\?|$)/i.test(url);
}
function parecePdf(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

export default function VistaPreviaModal({
  url,
  tipo = "auto",
  onClose
}: {
  url: string | null;
  tipo?: TipoVistaPrevia;
  onClose: () => void;
}) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [url]);

  if (!url) return null;

  const esPdf = tipo === "pdf" || (tipo === "auto" && parecePdf(url));
  const esImagen = !esPdf && (tipo === "imagen" || pareceImagen(url) || tipo === "auto");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 42, 74, 0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 4,
          width: 820,
          maxWidth: "94vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)"
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>Vista previa</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <a href={url} target="_blank" rel="noopener noreferrer" className="rowbtn" style={{ fontSize: 12 }}>
              Abrir en pestaña nueva ↗
            </a>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--ink-soft)" }}
            >
              ×
            </button>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: "#f4f4f2",
            minHeight: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto"
          }}
        >
          {error ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>
              No se pudo cargar la vista previa aquí.
              <br />
              Usa &quot;Abrir en pestaña nueva&quot; arriba para verlo directamente.
            </div>
          ) : esImagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Vista previa del archivo"
              style={{ maxWidth: "100%", maxHeight: "75vh", display: "block" }}
              onError={() => setError(true)}
            />
          ) : (
            <iframe
              src={url}
              title="Vista previa"
              style={{ width: "100%", height: "75vh", border: "none", display: "block" }}
              onError={() => setError(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
