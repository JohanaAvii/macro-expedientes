"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Trail from "@/components/Trail";
import ContribuyenteBuscador from "@/components/ContribuyenteBuscador";
import ContribuyenteEtiqueta from "@/components/ContribuyenteEtiqueta";
import { generarConstanciaExpedientes } from "@/lib/constancia";
import { descargarCSV } from "@/lib/csv";

type Expediente = { numeroExpediente: string; sujetoImpuesto: string };
type Documento = {
  numeroExpediente: string;
  sujetoImpuesto: string;
  documentoExpedienteId: string;
  nombre: string;
  numeroDocumento: string;
  archivoUrl: string | null;
};
type NotifDoc = {
  documentoExpedienteId: string;
  nombre: string;
  sujetoImpuesto: string;
  numeroGuia: string;
  estadoEnvio: string;
  documentoUrl: string | null;
  guiaUrl: string | null;
};

const TRAIL_NODES = [
  { key: "sujeto", label: "Sujeto impuesto" },
  { key: "expediente", label: "Expediente" },
  { key: "documento", label: "Documento" },
  { key: "notificacion", label: "Notificación / Guía" }
];

export default function ExpedientesTab() {
  const { data: session } = useSession();
  const [sujeto, setSujeto] = useState("010205210054001");
  const [numeroExpediente, setNumeroExpediente] = useState("");
  const [criterioUsado, setCriterioUsado] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [expedientes, setExpedientes] = useState<Expediente[] | null>(null);
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [notificaciones, setNotificaciones] = useState<NotifDoc[] | null>(null);

  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNodes, setActiveNodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function limpiar() {
    setSujeto("");
    setNumeroExpediente("");
    setExpedientes(null);
    setDocumentos(null);
    setNotificaciones(null);
    setSeleccionado(null);
    setError(null);
    setActiveNodes([]);
  }

  async function buscarExpedientes(overrideSujeto?: string) {
    setError(null);
    const sujetoUsar = overrideSujeto ?? sujeto;
    if (!sujetoUsar.trim() && !numeroExpediente.trim()) {
      setError("Debe ingresar una referencia, sujeto impuesto, número de expediente o liquidación para realizar la consulta.");
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams();
    if (numeroExpediente.trim()) {
      qs.set("expediente", numeroExpediente.trim());
      setCriterioUsado(`Número de expediente: ${numeroExpediente.trim()}`);
    } else {
      qs.set("sujeto", sujetoUsar.trim());
      setCriterioUsado(`Referencia corta / Sujeto impuesto: ${sujetoUsar.trim()}`);
    }

    const res = await fetch(`/api/expedientes?${qs.toString()}`);
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error ?? "No se encontraron registros asociados al criterio de búsqueda ingresado.");
      setExpedientes([]);
      return;
    }
    setExpedientes(json.data);
    setDocumentos(null);
    setNotificaciones(null);
    setSeleccionado(null);
    setActiveNodes(json.data.length ? ["sujeto"] : []);
  }

  function buscarPorContribuyente(sujetoEncontrado: string) {
    setSujeto(sujetoEncontrado);
    setNumeroExpediente("");
    buscarExpedientes(sujetoEncontrado);
  }

  async function consultarDocumentos(numero: string) {
    setSeleccionado(numero);
    setLoading(true);
    const [resDocs, resNotif] = await Promise.all([
      fetch(`/api/expedientes/${encodeURIComponent(numero)}/documentos`),
      fetch(`/api/expedientes/${encodeURIComponent(numero)}/notificaciones`)
    ]);
    const [jsonDocs, jsonNotif] = await Promise.all([resDocs.json(), resNotif.json()]);
    setLoading(false);
    setDocumentos(jsonDocs.data);
    setNotificaciones(jsonNotif.data);
    setActiveNodes(["sujeto", "expediente", "documento", "notificacion"]);
  }

  async function descargarConstancia() {
    if (!expedientes) return;
    setGenerandoPdf(true);
    try {
      await generarConstanciaExpedientes({
        usuario: session?.user?.name ?? session?.user?.email ?? "Usuario",
        criterio: criterioUsado,
        expedientes,
        documentos,
        notificaciones
      });
    } finally {
      setGenerandoPdf(false);
    }
  }

  function exportarNotificacionesCSV() {
    if (!notificaciones || notificaciones.length === 0) return;
    descargarCSV(
      `notificaciones-expediente-${seleccionado ?? "consulta"}.csv`,
      [
        { header: "ID documento", valor: (n: NotifDoc) => n.documentoExpedienteId, comoTexto: true },
        { header: "Nombre", valor: (n: NotifDoc) => n.nombre },
        { header: "N.º de guía", valor: (n: NotifDoc) => n.numeroGuia, comoTexto: true },
        { header: "Estado de envío", valor: (n: NotifDoc) => n.estadoEnvio },
        { header: "Sujeto impuesto", valor: (n: NotifDoc) => n.sujetoImpuesto, comoTexto: true }
      ],
      notificaciones
    );
  }

  return (
    <div className="stage">
      <aside className="panel">
        <div className="panel-head">Filtros · expedientes</div>
        <div className="panel-body">
          <div className="field">
            <label htmlFor="inp-sujeto">Referencia corta / Sujeto impuesto</label>
            <input
              id="inp-sujeto"
              type="text"
              placeholder="010205210054001"
              value={sujeto}
              onChange={(e) => setSujeto(e.target.value)}
            />
            <div className="hint">Se conserva como texto para no perder ceros iniciales.</div>
          </div>
          <div className="field">
            <label htmlFor="inp-expediente">Número de expediente</label>
            <input
              id="inp-expediente"
              type="text"
              placeholder="Opcional — filtra directo por expediente"
              value={numeroExpediente}
              onChange={(e) => setNumeroExpediente(e.target.value)}
            />
          </div>
          <div className="btnrow">
            <button className="btn btn-primary" onClick={() => buscarExpedientes()} disabled={loading}>
              Buscar expedientes <span>↵</span>
            </button>
            <button className="btn btn-danger-ghost" onClick={limpiar}>
              Limpiar filtros
            </button>
          </div>
          <div className="legend">
            <div className="row">
              <span className="sw" style={{ background: "var(--sage)" }}></span> ENTREGADO — guía confirmada
            </div>
            <div className="row">
              <span className="sw" style={{ background: "var(--rust)" }}></span> DEVUELTO — retorna al remitente
            </div>
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
            <h2>Sección 1 · Expedientes encontrados</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="count">
                {expedientes ? `${expedientes.length} ${expedientes.length === 1 ? "resultado" : "resultados"}` : "—"}
              </span>
              {expedientes && (
                <button className="export" onClick={descargarConstancia} disabled={generandoPdf}>
                  {generandoPdf ? "Generando…" : "Descargar constancia (PDF)"}
                </button>
              )}
            </div>
          </div>
          {expedientes && expedientes.length > 0 && (
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", background: "#FAFAF7" }}>
              <ContribuyenteEtiqueta sujetoImpuesto={expedientes[0].sujetoImpuesto} />
            </div>
          )}
          {!expedientes ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Sin búsqueda activa</p>
              <p className="sub">Ingrese una referencia corta o sujeto impuesto.</p>
            </div>
          ) : expedientes.length === 0 ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>No se encontraron registros</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Número de expediente</th>
                  <th>Sujeto impuesto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expedientes.map((e) => (
                  <tr
                    key={e.numeroExpediente}
                    className={`selectable ${seleccionado === e.numeroExpediente ? "selected" : ""}`}
                    onClick={() => consultarDocumentos(e.numeroExpediente)}
                  >
                    <td className="code">{e.numeroExpediente}</td>
                    <td className="code">{e.sujetoImpuesto}</td>
                    <td>
                      <button className="rowbtn">Ver documentos →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="section">
          <div className="section-head">
            <h2>Sección 2 · Documentos del expediente</h2>
            <span className="count">
              {documentos ? `${documentos.length} ${documentos.length === 1 ? "documento" : "documentos"}` : "—"}
            </span>
          </div>
          {!documentos ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Seleccione un expediente</p>
              <p className="sub">Haga clic en un expediente de la sección 1.</p>
            </div>
          ) : documentos.length === 0 ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Este expediente no tiene documentos asociados.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N.º expediente</th>
                  <th>Sujeto impuesto</th>
                  <th>ID documento</th>
                  <th>Nombre del documento</th>
                  <th>N.º documento</th>
                  <th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((d) => (
                  <tr key={d.documentoExpedienteId}>
                    <td className="code">{d.numeroExpediente}</td>
                    <td className="code">{d.sujetoImpuesto}</td>
                    <td className="code">{d.documentoExpedienteId}</td>
                    <td>{d.nombre}</td>
                    <td className="code">{d.numeroDocumento}</td>
                    <td>
                      {d.archivoUrl ? (
                        <a className="rowbtn" href={d.archivoUrl} target="_blank" rel="noopener noreferrer">
                          Ver PDF ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>No cargado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="section">
          <div className="section-head">
            <h2>Sección 3 · Notificaciones del expediente</h2>
            <button className="export" onClick={exportarNotificacionesCSV} disabled={!notificaciones || notificaciones.length === 0}>
              Exportar CSV
            </button>
          </div>
          {!notificaciones ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Seleccione un expediente</p>
              <p className="sub">Las notificaciones se cargan junto con los documentos.</p>
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="empty">
              <div className="glyph">—</div>
              <p>Ninguno de los documentos del expediente tiene guía o notificación asociada.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID documento</th>
                  <th>Nombre</th>
                  <th>N.º de guía</th>
                  <th>Estado de envío</th>
                  <th>Sujeto impuesto</th>
                  <th>Archivo</th>
                </tr>
              </thead>
              <tbody>
                {notificaciones.map((n, i) => (
                  <tr key={i}>
                    <td className="code">{n.documentoExpedienteId}</td>
                    <td>{n.nombre}</td>
                    <td className="code">{n.numeroGuia}</td>
                    <td>
                      <span className={`status ${n.estadoEnvio}`}>
                        <span className="dot"></span>
                        {n.estadoEnvio}
                      </span>
                    </td>
                    <td className="code">{n.sujetoImpuesto}</td>
                    <td>
                      {n.guiaUrl ? (
                        <a className="rowbtn" href={n.guiaUrl} target="_blank" rel="noopener noreferrer">
                          Ver imagen ↗
                        </a>
                      ) : (
                        <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>No cargado</span>
                      )}
                    </td>
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
