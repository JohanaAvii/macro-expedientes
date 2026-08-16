"use client";

export default function VistaPreviaModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;

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
        <div style={{ flex: 1, background: "#f4f4f2" }}>
          {/* El iframe muestra bien tanto imágenes (jpg/png) como PDF,
              sin depender de saber de antemano cuál de los dos es. */}
          <iframe src={url} title="Vista previa" style={{ width: "100%", height: "75vh", border: "none", display: "block" }} />
        </div>
      </div>
    </div>
  );
}
