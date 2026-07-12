"use client";

import type { ClientDetail } from "../types";

export function ClientTagsCard({ client }: { client: ClientDetail }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        padding: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>태그</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(client.tags || []).map((tag, i) => (
          <span
            key={i}
            style={{
              padding: "4px 10px",
              borderRadius: 12,
              background: "var(--surface-muted)",
              color: "var(--action)",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {tag}
          </span>
        ))}
        {(!client.tags || client.tags.length === 0) && (
          <span style={{ fontSize: 12, color: "var(--gray-300)" }}>태그 없음</span>
        )}
      </div>
    </div>
  );
}
