import { Button } from "order-ai";

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button variant="primary">발주 등록</Button>
      <Button variant="secondary">임시 저장</Button>
      <Button variant="outline">엑셀 내보내기</Button>
      <Button variant="ghost">취소</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button size="sm">작게</Button>
      <Button size="md">보통</Button>
      <Button size="lg">크게</Button>
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button variant="primary">기본</Button>
      <Button variant="primary" disabled>비활성</Button>
      <Button variant="primary" loading>로딩</Button>
    </div>
  );
}
