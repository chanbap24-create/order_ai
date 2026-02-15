'use client';

import { useState, useCallback } from 'react';
import SalesTabs from './components/SalesTabs';
import type { SalesTabId } from './components/SalesTabs';
import ClientTab from './components/ClientTab';
import RecommendTab from './components/RecommendTab';
import MeetingTab from './components/MeetingTab';
import BriefingTab from './components/BriefingTab';
import AlertTab from './components/AlertTab';

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTabId>('clients');
  const [alertCount, setAlertCount] = useState<number>(0);

  const handleAlertCountChange = useCallback((count: number) => {
    setAlertCount(count);
  }, []);

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      background: '#fafaf8',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 16px',
      }}>
        {/* 헤더 */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#1a1a2e',
            margin: 0,
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: '0.05em',
          }}>
            Sales Support
          </h1>
          <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
            영업 지원 시스템
          </p>
        </div>

        {/* 탭 */}
        <SalesTabs activeTab={activeTab} onTabChange={setActiveTab} alertCount={alertCount} />

        {/* 탭 콘텐츠 */}
        {activeTab === 'clients' && <ClientTab />}
        {activeTab === 'recommend' && <RecommendTab />}
        {activeTab === 'meetings' && <MeetingTab />}
        {activeTab === 'briefing' && <BriefingTab />}
        {activeTab === 'alerts' && <AlertTab onCountChange={handleAlertCountChange} />}
      </div>
    </div>
  );
}
