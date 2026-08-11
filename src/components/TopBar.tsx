"use client";

import Image from "next/image";
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
        <Image
          className="shield"
          src="/images/escudo-valledupar.png"
          alt="Escudo Alcaldía de Valledupar"
          width={520}
          height={263}
          style={{ height: 46, width: "auto" }}
          priority
        />
        <div className="divider"></div>
        <div>
          <span className="module">Macro de Expedientes</span>
          <span className="module-sub">Secretaría de Hacienda</span>
        </div>
      </div>
      <div className="entity">
        <div className="user">{initials}</div>
        <span>{userName}</span>
        <button className="logout" onClick={() => signOut({ callbackUrl: "/login" })}>
          Salir
        </button>
      </div>
    </div>
  );
}
