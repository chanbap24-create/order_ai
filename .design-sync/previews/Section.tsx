import { Section, Button } from "order-ai";

export function Bordered() {
  return (
    <Section
      title="오늘의 수금"
      meta="3건"
      actions={<Button size="sm" variant="outline">전체보기</Button>}
    >
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        스시소라 정자점 · 220,000원 · 연체 D+2<br />
        뚜르몽 · 145,000원 · 오늘 약속<br />
        비스트로 뱅 · 98,000원 · 오늘 약속
      </div>
    </Section>
  );
}

export function Plain() {
  return (
    <Section bordered={false} padding="none">
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        테두리·배경 없이 콘텐츠만 감싸는 섹션 (bordered=false)
      </div>
    </Section>
  );
}
