'use client';

import dynamic from 'next/dynamic';
import type { SalesTabId } from '../../components/SalesTabs';
import { ListSkeleton } from '@/app/components/ui';

const MeetingTab = dynamic(() => import('../../components/MeetingTab'), {
  ssr: false,
  loading: () => <ListSkeleton rows={6} />,
});
const BriefingTab = dynamic(() => import('../../components/BriefingTab'), { ssr: false });
const ShipmentTab = dynamic(() => import('../../components/ShipmentTab'), { ssr: false });
const AlertTab = dynamic(() => import('../../components/AlertTab'), { ssr: false });
const AnalysisTab = dynamic(() => import('../../components/AnalysisTab'), { ssr: false });
const LedgerTab = dynamic(() => import('../../components/LedgerTab'), { ssr: false });
const ItemLedgerTab = dynamic(() => import('../../components/ItemLedgerTab'), { ssr: false });
const OutstandingTab = dynamic(() => import('../../components/OutstandingTab'), { ssr: false });
const PaymentTermsTab = dynamic(() => import('../../components/PaymentTermsTab'), { ssr: false });
const ClientListTab = dynamic(() => import('../../components/ClientListTab'), { ssr: false });
const ExpenseTab = dynamic(() => import('../../components/ExpenseTab'), { ssr: false });
const RecommendQuoteTab = dynamic(() => import('../../components/RecommendQuoteTab'), { ssr: false });
const TastingApprovalTab = dynamic(() => import('../../components/TastingApprovalTab'), { ssr: false });
const PromotionTab = dynamic(() => import('../../components/PromotionTab'), { ssr: false });

type Props = {
  activeTab: SalesTabId;
  currentManager: string;
  isAdmin: boolean;
  userRole: string;
  userDepartment: string;
  managerList: string[];
  onAlertCountChange: (count: number) => void;
  onTabChange: (tab: SalesTabId) => void;
};

export function TabContent(p: Props) {
  const meetingAdmin = p.userRole === 'executive' ? false : p.isAdmin;

  switch (p.activeTab) {
    case 'meetings':
      return <MeetingTab currentManager={p.currentManager} isAdmin={meetingAdmin} initialManagers={p.managerList} />;
    case 'briefing':
      return <BriefingTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'shipments':
      return <ShipmentTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'analysis':
      return <AnalysisTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'ledger':
      return <LedgerTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'item-ledger':
      return <ItemLedgerTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'outstanding':
      return <OutstandingTab currentManager={p.currentManager} isAdmin={p.isAdmin} initialManagers={p.managerList} />;
    case 'payment-terms':
      return <PaymentTermsTab currentManager={p.currentManager} isAdmin={p.isAdmin} initialManagers={p.managerList} />;
    case 'client-list':
      return <ClientListTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'alerts':
      return <AlertTab currentManager={p.currentManager} isAdmin={p.isAdmin} onCountChange={p.onAlertCountChange} onTabChange={p.onTabChange} />;
    case 'expense':
      return <ExpenseTab currentManager={p.currentManager} isAdmin={p.isAdmin} department={p.userDepartment} />;
    case 'recommend-quote':
      return <RecommendQuoteTab currentManager={p.currentManager} isAdmin={p.isAdmin} />;
    case 'tasting-approval':
      return <TastingApprovalTab currentManager={p.currentManager} isAdmin={p.isAdmin} department={p.userDepartment} />;
    case 'promotion':
      return <PromotionTab />;
    default:
      return null;
  }
}
