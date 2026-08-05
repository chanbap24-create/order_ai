import { Stack, Button } from "order-ai";

export function Horizontal() {
  return (
    <Stack direction="horizontal" gap={12} align="center">
      <Button size="sm">저장</Button>
      <Button size="sm" variant="outline">취소</Button>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>gap 12, 가로</span>
    </Stack>
  );
}

export function Vertical() {
  return (
    <Stack direction="vertical" gap={8}>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>첫 번째 줄</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>두 번째 줄</div>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>세 번째 줄</div>
    </Stack>
  );
}

export function SpaceBetween() {
  return (
    <Stack direction="horizontal" justify="between" align="center" fullWidth>
      <span style={{ fontSize: 13, fontWeight: 700 }}>합계</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>1,240,000원</span>
    </Stack>
  );
}
