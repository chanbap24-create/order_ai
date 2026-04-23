"use client";

export function Spinner() {
  return (
    <>
      <div
        style={{
          width: 16,
          height: 16,
          border: "2px solid var(--color-border)",
          borderTopColor: "var(--color-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
