import { PageHeader, Button } from "order-ai";

export function WithActions() {
  return (
    <PageHeader
      eyebrow="Sales"
      title="거래처 분석"
      subtitle="미수·수금·추천을 한 화면에서 관리합니다"
      actions={
        <>
          <Button variant="outline" size="sm">엑셀</Button>
          <Button size="sm">새 견적</Button>
        </>
      }
    />
  );
}

export function TitleOnly() {
  return <PageHeader title="재고 조회" />;
}

export function WithEyebrow() {
  return <PageHeader eyebrow="Inventory" title="와인 재고" subtitle="CDV · DL 통합 재고 현황" />;
}
