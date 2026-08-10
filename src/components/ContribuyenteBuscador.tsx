"use client";

import { useState } from "react";

type Resultado = { sujetoImpuesto: string; nombre: string | null; identificacion: string | null };

export default function ContribuyenteBuscador({ onSeleccionar }: { onSeleccionar: (sujetoImpuesto: string) => void }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar() {
    setError(null);
    if (!texto.trim()) {
      setError("Escriba un nombre o número de identificación.");
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(`/api/contribuyentes?buscar=${encodeURIComponent(texto.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "No se encontraron coincidencias.");
        setResultados([]);
        return;
      }
      setResultados(json.data);
    } catch {
      setError("No se pudo completar la búsqueda (falla de red o del servidor). Intenta de nuevo.");
      setResultados(null);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor="inp-contribuyente">Nombre o identificación</label>
      <input
        id="inp-contribuyente"
        type="text"
        placeholder="Ej. Omar Tarifa / 5092078"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && buscar()}
      />
      <div className="hint">Busca entre los contribuyentes ya registrados (extraídos de los documentos o agregados manualmente).</div>
      <button className="btn btn-ghost" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={buscar} disabled={buscando}>
        {buscando ? "Buscando…" : "Buscar contribuyente"}
      </button>
      {error && (
        <div className="hint" style={{ color: "var(--rust)", marginTop: 6 }}>
          {error}
        </div>
      )}
      {resultados && resultados.length > 0 && (
        <div style={{ marginTop: 8, border: "1px solid var(--line)", borderRadius: 2, overflow: "hidden" }}>
          {resultados.map((r) => (
            <div
              key={r.sujetoImpuesto}
              style={{ padding: "8px 10px", borderBottom: "1px solid #EEEFE9", cursor: "pointer", fontSize: 12.5 }}
              onClick={() => onSeleccionar(r.sujetoImpuesto)}
              className="selectable"
            >
              <strong>{r.nombre ?? "(sin nombre)"}</strong>
              <br />
              <span className="code" style={{ fontSize: 11 }}>
                {r.identificacion ?? "—"} · {r.sujetoImpuesto}
              </span>
            </div>
          ))}
        </div>
      )}
      {resultados && resultados.length === 0 && !error && (
        <div className="hint" style={{ marginTop: 6 }}>
          Sin coincidencias registradas todavía.
        </div>
      )}
    </div>
  );
}
