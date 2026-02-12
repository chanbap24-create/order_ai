'use client';

import { useState } from 'react';
import type { TabId } from '@/app/types/wine';
import AdminTabs from './components/AdminTabs';
import UploadTab from './components/UploadTab';
import DashboardTab from './components/DashboardTab';
import NewWineTab from './components/NewWineTab';
import AllWinesTab from './components/AllWinesTab';
import TastingNoteTab from './components/TastingNoteTab';
import PriceListTab from './components/PriceListTab';
import ChangeLogTab from './components/ChangeLogTab';
import '@/app/styles/design-system.css';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [newWineCount, setNewWineCount] = useState<number>(0);

  // Downloads 업로드 완료 시 신규 와인 수 업데이트
  const handleUploadComplete = (type: string, result: Record<string, unknown>) => {
    if (type === 'downloads' && typeof result.newWinesDetected === 'number') {
      setNewWineCount(result.newWinesDetected);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 48px)',
      background: '#fafaf8',
    }}>
      <div className="ds-page">
        {/* Header */}
        <div className="ds-page-header">
          <h1 className="ds-page-title">관리자</h1>
        </div>

        {/* 탭 바 */}
        <AdminTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          newWineCount={newWineCount}
        />

        {/* 탭 콘텐츠 */}
        {activeTab === 'upload' && <UploadTab onUploadComplete={handleUploadComplete} />}
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'new-wine' && <NewWineTab />}
        {activeTab === 'all-wines' && <AllWinesTab />}
        {activeTab === 'tasting-note' && <TastingNoteTab />}
        {activeTab === 'price-list' && <PriceListTab />}
        {activeTab === 'change-log' && <ChangeLogTab />}
      </div>

      {/* Toast container */}
      <style>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
