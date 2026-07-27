"use client";

export default function Trail({
  nodes,
  active
}: {
  nodes: { key: string; label: string }[];
  active: string[];
}) {
  return (
    <div className="trail">
      <span className="trail-label">Trazabilidad</span>
      {nodes.map((n, i) => (
        <span key={n.key} style={{ display: "flex", alignItems: "center" }}>
          <span className={`node ${active.includes(n.key) ? "active" : ""}`}>
            <span className="k">{String(i + 1).padStart(2, "0")}</span> {n.label}
          </span>
          {i < nodes.length - 1 && <span className="chevron">→</span>}
        </span>
      ))}
    </div>
  );
}
