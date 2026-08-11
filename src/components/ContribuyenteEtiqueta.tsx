"use client";

import { useEffect, useState } from "react";

export default function ContribuyenteEtiqueta({ sujetoImpuesto }: { sujetoImpuesto: string }) {
  const [nombre, setNombre] = useState<string | null | undefined>(undefined); // undefined = cargando
  const [identificacion, setIdentificacion] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formId, setFormId] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombre(undefined);
    fetch(`/api/contribuyentes?sujetoImpuesto=${encodeURIComponent(sujetoImpuesto)}`)
      .then((r) => r.json())
      .then((json) => {
        const encontrado = json.data?.[0];
        setNombre(encontrado?.nombre ?? null);
        setIdentificacion(encontrado?.identificacion ?? null);
      })
      .catch(() => setNombre(null));
  }, [sujetoImpuesto]);

  async function guardar() {
    if (!formNombre.trim() && !formId.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/contribuyentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujetoImpuesto, nombre: formNombre.trim(), identificacion: formId.trim() })
      });
      const json = await res.json();
      if (res.ok) {
        setNombre(json.data.nombre);
        setIdentificacion(json.data.identificacion);
        setEditando(false);
      }
    } catch {
      // se queda en modo edición; el usuario puede intentar de nuevo
    } finally {
      setGuardando(false);
    }
  }

  if (nombre === undefined) return null; // aún cargando, no parpadea contenido

  if (editando) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Nombre"
          value={formNombre}
          onChange={(e) => setFormNombre(e.target.value)}
          style={{ fontSize: 12, padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 2, width: 160 }}
        />
        <input
          type="text"
          placeholder="Identificación"
          value={formId}
          onChange={(e) => setFormId(e.target.value)}
          style={{ fontSize: 12, padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 2, width: 120 }}
        />
        <button className="rowbtn" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button className="rowbtn" style={{ color: "var(--ink-soft)" }} onClick={() => setEditando(false)}>
          Cancelar
        </button>
      </div>
    );
  }

  if (nombre || identificacion) {
    return (
      <span style={{ fontSize: 12.5 }}>
        <strong>{nombre ?? "(sin nombre)"}</strong>
        {identificacion && <span className="code"> · {identificacion}</span>}
      </span>
    );
  }

  return (
    <button className="rowbtn" style={{ fontSize: 12 }} onClick={() => setEditando(true)}>
      + Agregar nombre / identificación
    </button>
  );
}