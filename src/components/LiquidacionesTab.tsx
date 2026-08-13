"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Trail from "@/components/Trail";
import ContribuyenteBuscador from "@/components/ContribuyenteBuscador";
import ContribuyenteEtiqueta from "@/components/ContribuyenteEtiqueta";
import { generarConstanciaLiquidaciones } from "@/lib/constancia";
import { descargarCSV } from "@/lib/csv";

type Liquidacion = { sujetoImpuesto: string; liquidacionOficialId: string; numeroLiquidacionOficial: string };
type NotifLiq = { numeroLiquidacionOficial: string; sujetoImpuesto: string; numeroNotificacion: string; numeroGuia: string };

const TRAIL_NODES = [
  { key: "sujeto", label: "Sujeto impuesto" },
  { key: "liquidacion", label: "Liquidación oficial" },
  { key: "notificacion", label: "Notificación / Guía" }
];

export default function LiquidacionesTab() {
  const { data: session } = useSession();
  const [sujeto, setSujeto] = useState("010205210054001");
  const [numeroLiquidacion, setNumeroLiquidacion] = useState("");
  const [criterioUsado, setCriterioUsado] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);

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

  async function buscarLiquidaciones(overrideSujeto?: string) {
    setError(null);
    const sujetoUsar = overrideSujeto ?? sujeto;
    if (!sujetoUsar.trim() && !numeroLiquidacion.trim()) {
      setError("Debe ingresar una referencia, sujeto impuesto, número de expediente o liquidación para realizar la consulta.");
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams();
    if (numeroLiquidacion.trim()) {
      qs.set("liquidacion", numeroLiquidacion.trim());
      setCriterioUsado(`Número de liquidación oficial: ${numeroLiquidacion.trim()}`);
    } else {
      qs.set("sujeto", sujetoUsar.trim());
      setCriterioUsado(`Sujeto impuesto: ${sujetoUsar.trim()}`);
    }

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

  function buscarPorContribuyente(sujetoEncontrado: string) {
    setSujeto(sujetoEncontrado);
    setNumeroLiquidacion("");
    buscarLiquidaciones(sujetoEncontrado);
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

  async function descargarConstancia() {
    if (!liquidaciones) return;
    setGenerandoPdf(true);
    try {
      await generarConstanciaLiquidaciones({
        usuario: session?.user?.name ?? session?.user?.email ?? "Usuario",
        criterio: criterioUsado,
        liquidaciones,
        notificaciones
      });
    } finally {
      setGenerandoPdf(false);
    }
  }

  function exportarNotificacionesCSV() {
    if (!notificaciones || notificaciones.length === 0) return;
    descargarCSV(
      `notificaciones-liquidacion-${seleccionado ?? "consulta"}.csv`,
      [
        { header: "N.º liquidación oficial", valor: (n: NotifLiq) => n.numeroLiquidacionOficial, comoTexto: true },
        { header: "Sujeto impuesto", valor: (n: NotifLiq) => n.sujetoImpuesto, comoTexto: true },
        { header: "N.º notificación", valor: (n: NotifLiq) => n.numeroNotificacion, comoTexto: true },
        { header: "N.º de guía", valor: (n: NotifLiq) => n.numeroGuia, comoTexto: true }
      ],
      notificaciones
    );
  }

  return (
    <div className="stage">
      <aside className="panel">
        <div className="panel-head">Filtros · Expedientes</div>
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
            <label htmlFor="inp-liq">Número de Expedientes oficial</label>
            <input
              id="inp-liq"
              type="text"
              placeholder="Opcional — filtra directo por liquidación"
              value={numeroLiquidacion}
              onChange={(e) => setNumeroLiquidacion(e.target.value)}
            />
          </div>
          <div className="btnrow">
            <button className="btn btn-primary" onClick={() => buscarLiquidaciones()} disabled={loading}>
              Buscar Expedientes <span>↵</span>
            </button>
            <button className="btn btn-danger-ghost" onClick={limpiar}>
              Limpiar filtros
            </button>
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--line)" }}>
            <ContribuyenteBuscador onSeleccionar={buscarPorContribuyente} />
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
            <h2>Sección 1 · Expedientes oficiales</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="count">
                {liquidaciones ? `${liquidaciones.length} ${liquidaciones.length === 1 ? "resultado" : "resultados"}` : "—"}
              </span>
              {liquidaciones && (
                <button className="export" onClick={descargarConstancia} disabled={generandoPdf}>
                  {generandoPdf ? "Generando…" : "Descargar constancia (PDF)"}
                </button>
              )}
            </div>
          </div>
          {liquidaciones && liquidaciones.length > 0 && (
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "#FAFAF7" }}>
              <ContribuyenteEtiqueta sujetoImpuesto={liquidaciones[0].sujetoImpuesto} />
            </div>
          )}
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
                  <th>ID Expedientes oficial</th>
                  <th>N.º Expedientes oficial</th>
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
            <h2>Sección 2 · Notificaciones del Expedientes</h2>
            <button className="export" onClick={exportarNotificacionesCSV} disabled={!notificaciones || notificaciones.length === 0}>
              Exportar CSV
            </button>
          </div>
          {!notificaciones ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Seleccione un Expediente</p>
              <p className="sub">Aparecerán aquí su notificación y guía.</p>
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Esta Expedientes no tiene notificación o guía asociada.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N.º Expedientes oficial</th>
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
