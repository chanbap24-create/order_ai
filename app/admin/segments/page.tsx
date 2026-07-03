// 직접 URL 접근(/admin/segments)용 래퍼 — 어드민 '업장추천' 탭과 동일 컴포넌트 재사용.
import SegmentsTab from '../components/SegmentsTab';

export default function SegmentsPage() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 14px 80px' }}>
      <SegmentsTab />
    </div>
  );
}
