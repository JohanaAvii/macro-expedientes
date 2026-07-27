"use client";

import { useState } from "react";
import Trail from "@/components/Trail";

type Liquidacion = { sujetoImpuesto: string; liquidacionOficialId: string; numeroLiquidacionOficial: string };
type NotifLiq = { numeroLiquidacionOficial: string; sujetoImpuesto: string; numeroNotificacion: string; numeroGuia: string };

const TRAIL_NODES = [
  { key: "sujeto", label: "Sujeto impuesto" },
  { key: "liquidacion", label: "Liquidación oficial" },
  { key: "notificacion", label: "Notificación / Guía" }
];

export default function LiquidacionesTab() {
  const [sujeto, setSujeto] = useState("010205210054001");
  const [numeroLiquidacion, setNumeroLiquidacion] = useState("");

  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[] | null>(null);
  const [notificaciones, setNotificaciones] = useState<NotifLiq[] | null>(null);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function limpiar() {
    setSujeto("");
    setNumeroLiquidacion("");
    setLiquidaciones(null);
    setNotificaciones(null);
    setSeleccionado(null);
    setError(null);
    setActiveNodes([]);
  }

  async function buscarLiquidaciones() {
    setError(null);
    if (!sujeto.trim() && !numeroLiquidacion.trim()) {
      setError("Debe ingresar una referencia, sujeto impuesto, número de expediente o liquidación para realizar la consulta.");
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams();
    if (numeroLiquidacion.trim()) qs.set("liquidacion", numeroLiquidacion.trim());
    else qs.set("sujeto", sujeto.trim());

    const res = await fetch(`/api/liquidaciones?${qs.toString()}`);
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "No se encontraron registros asociados al criterio de búsqueda ingresado.");
      setLiquidaciones([]);
      return;
    }
    setLiquidaciones(json.data);
    setNotificaciones(null);
    setSeleccionado(null);
    setActiveNodes(json.data.length ? ["sujeto"] : []);
  }

  async function consultarNotificaciones(numero: string) {
    setSeleccionado(numero);
    setLoading(true);
    const res = await fetch(`/api/liquidaciones/${encodeURIComponent(numero)}/notificaciones`);
    const json = await res.json();
    setLoading(false);
    setNotificaciones(json.data);
    setActiveNodes(["sujeto", "liquidacion", "notificacion"]);
  }

  return (
    <div className="stage">
      <aside className="panel">
        <div className="panel-head">Filtros · liquidaciones</div>
        <div className="panel-body">
          <div className="field">
            <label htmlFor="inp-sujeto-liq">Sujeto impuesto</label>
            <input
              id="inp-sujeto-liq"
              type="text"
              placeholder="010205210054001"
              value={sujeto}
              onChange={(e) => setSujeto(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="inp-liq">Número de liquidación oficial</label>
            <input
              id="inp-liq"
              type="text"
              placeholder="Opcional — filtra directo por liquidación"
              value={numeroLiquidacion}
              onChange={(e) => setNumeroLiquidacion(e.target.value)}
            />
          </div>
          <div className="btnrow">
            <button className="btn btn-primary" onClick={buscarLiquidaciones} disabled={loading}>
              Buscar liquidaciones <span>↵</span>
            </button>
            <button className="btn btn-danger-ghost" onClick={limpiar}>
              Limpiar filtros
            </button>
          </div>
        </div>
      </aside>

      <main>
        <Trail nodes={TRAIL_NODES} active={activeNodes} />

        {error && (
          <div className="alert">
            ⚠ <div>{error}</div>
          </div>
        )}

        <div className="section">
          <div className="section-head">
            <h2>Sección 1 · Liquidaciones oficiales</h2>
            <span className="count">
              {liquidaciones ? `${liquidaciones.length} ${liquidaciones.length === 1 ? "resultado" : "resultados"}` : "—"}
            </span>
          </div>
          {!liquidaciones ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Sin búsqueda activa</p>
              <p className="sub">Ingrese un sujeto impuesto.</p>
            </div>
          ) : liquidaciones.length === 0 ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>No se encontraron registros</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Sujeto impuesto</th>
                  <th>ID liquidación oficial</th>
                  <th>N.º liquidación oficial</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {liquidaciones.map((l) => (
                  <tr
                    key={l.numeroLiquidacionOficial}
                    className={`selectable ${seleccionado === l.numeroLiquidacionOficial ? "selected" : ""}`}
                    onClick={() => consultarNotificaciones(l.numeroLiquidacionOficial)}
                  >
                    <td className="code">{l.sujetoImpuesto}</td>
                    <td className="code">{l.liquidacionOficialId}</td>
                    <td className="code">{l.numeroLiquidacionOficial}</td>
                    <td>
                      <button className="rowbtn">Ver notificación →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="section">
          <div className="section-head">
            <h2>Sección 2 · Notificaciones de la liquidación</h2>
            <button className="export" onClick={() => alert("Exportación a CSV — los campos con ceros iniciales se conservan como texto.")}>
              Exportar CSV
            </button>
          </div>
          {!notificaciones ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Seleccione una liquidación</p>
              <p className="sub">Aparecerán aquí su notificación y guía.</p>
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Esta liquidación no tiene notificación o guía asociada.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N.º liquidación oficial</th>
                  <th>Sujeto impuesto</th>
                  <th>N.º notificación</th>
                  <th>N.º de guía</th>
                </tr>
              </thead>
              <tbody>
                {notificaciones.map((n, i) => (
                  <tr key={i}>
                    <td className="code">{n.numeroLiquidacionOficial}</td>
                    <td className="code">{n.sujetoImpuesto}</td>
                    <td className="code">{n.numeroNotificacion}</td>
                    <td className="code">{n.numeroGuia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
