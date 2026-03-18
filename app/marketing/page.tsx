'use client';

import ImportForecastTab from '@/app/admin/components/ImportForecastTab';

export default function MarketingPage() {
  return (
    <div style={{ paddingTop: 72, minHeight: '100vh', background: '#f5f3f0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingTop: 8 }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', margin: 0, fontFamily: "'Cormorant Garamond', serif", letterSpacing: '-0.01em' }}>Marketing</h1>
          <span style={{ fontSize: 12, color: '#a8a098', padding: '2px 8px', background: '#fff', borderRadius: 6, border: '1px solid #e8e4e0' }}>수입량 예측 분석</span>
        </div>
        <ImportForecastTab />
      </div>
    </div>
  );
}
