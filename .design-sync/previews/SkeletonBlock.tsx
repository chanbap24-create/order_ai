import { SkeletonBlock } from "order-ai";

export function Blocks() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SkeletonBlock w="60%" h={16} />
      <SkeletonBlock w="40%" h={12} />
      <SkeletonBlock w={120} h={12} />
    </div>
  );
}

export function Inline() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <SkeletonBlock w={40} h={40} r={20} />
      <SkeletonBlock w={160} h={14} />
    </div>
  );
}
