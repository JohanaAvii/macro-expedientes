"use client";

import { signOut } from "next-auth/react";

export default function TopBar({ userName }: { userName: string }) {
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="topbar">
      <div className="brand">
        <span className="mark">
          taxation<em>smart</em>
        </span>
        <span className="sep">/</span>
        <span className="module">Gestión de Reporte</span>
      </div>
      <div className="entity">
        <span className="badge">ALCALDÍA DE VALLEDUPAR</span>
        <span>{userName}</span>
        <button className="logout" onClick={() => signOut({ callbackUrl: "/login" })}>
          Salir
        </button>
      </div>
    </div>
  );
}
