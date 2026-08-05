import { Card } from "order-ai";

export function Basic() {
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
          리아타 소노마 코스트 샤르도네
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          재고 258병 · 공급가 33,000원 · 2022
        </div>
      </div>
    </Card>
  );
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
      <Card size="sm"><span style={{ fontSize: 12 }}>작은 카드 (sm)</span></Card>
      <Card size="md"><span style={{ fontSize: 13 }}>기본 카드 (md)</span></Card>
      <Card size="lg"><span style={{ fontSize: 14 }}>큰 카드 (lg)</span></Card>
    </div>
  );
}

export function Clickable() {
  return (
    <Card hover>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        마우스를 올리면 커서가 바뀌는 클릭형 카드
      </div>
    </Card>
  );
}
