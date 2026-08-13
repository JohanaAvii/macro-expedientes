"use client";

import { useState } from "react";
import ExpedientesTab from "@/components/ExpedientesTab";
import LiquidacionesTab from "@/components/LiquidacionesTab";

export default function DashboardShell() {
  const [tab, setTab] = useState<"expedientes" | "liquidaciones">("expedientes");

  return (
    <>
      <div className="header">
        <h1>Consulta unificada de cartera</h1>
        <p className="lede">
          Reemplaza la herramienta local en Excel/Access. Ingrese una referencia corta, sujeto impuesto,
          expediente o liquidación oficial para recorrer expedientes, documentos, notificaciones, guías y
          estados de envío desde una sola pantalla.
        </p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "expedientes" ? "active" : ""}`} onClick={() => setTab("expedientes")}>
          Cartera predial <span className="tag">expedientes</span>
        </button>
        <button className={`tab ${tab === "liquidaciones" ? "active" : ""}`} onClick={() => setTab("liquidaciones")}>
          Cartera ICA <span className="tag">expedientes</span>
        </button>
      </div>

      {tab === "expedientes" ? <ExpedientesTab /> : <LiquidacionesTab />}

      <div className="footnote">
        <span>Fuente: tablas oficiales de la plataforma — sin dependencia de Excel, macros VBA o Access.</span>
        <span className="code">ALCALDÍA DE VALLEDUPAR · SECRETARÍA DE HACIENDA · MÓDULO: Macro de Expedientes</span>
      </div>
    </>
  );
}
