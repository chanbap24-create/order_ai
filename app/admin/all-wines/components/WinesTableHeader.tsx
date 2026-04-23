'use client';

type Props = {
  isMobile: boolean;
  sortBy: string;
  onSort: (col: string) => void;
  sortArrow: (col: string) => string;
};

export function WinesTableHeader({ isMobile, sortBy, onSort, sortArrow }: Props) {
  if (isMobile) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '56px 1fr 56px',
        padding: '10px 12px', borderBottom: '2px solid #e5e7eb', background: '#f9fafb',
        fontSize: 12, fontWeight: 600, color: '#6b7280', position: 'sticky', top: 0, zIndex: 1,
        gap: 6, alignItems: 'center',
      }}>
        <span
          onClick={() => onSort('item_code')}
          style={{ cursor: 'pointer', userSelect: 'none', color: sortBy === 'item_code' ? '#8B1538' : '#6b7280' }}
        >
          품번{sortArrow('item_code')}
        </span>
        <span
          onClick={() => onSort('item_name_kr')}
          style={{ cursor: 'pointer', userSelect: 'none', color: sortBy === 'item_name_kr' ? '#8B1538' : '#6b7280' }}
        >
          품명{sortArrow('item_name_kr')}
        </span>
        <span
          onClick={() => onSort('available_stock')}
          style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'right', color: sortBy === 'available_stock' ? '#8B1538' : '#6b7280' }}
        >
          재고{sortArrow('available_stock')}
        </span>
      </div>
    );
  }

  const cols = [
    { key: 'item_code', label: '품번' },
    { key: 'country_en', label: '국가' },
    { key: 'region', label: '지역' },
    { key: 'brand', label: '브랜드' },
    { key: 'item_name_kr', label: '한글명' },
    { key: 'supply_price', label: '공급가', right: true },
    { key: 'available_stock', label: '재고', right: true },
    { key: '', label: '보세', right: true },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '58px 52px 60px 36px 1fr 70px 50px 50px 36px',
      padding: '10px 12px', borderBottom: '2px solid #e5e7eb', background: '#f9fafb',
      fontSize: 12, fontWeight: 600, color: '#6b7280', position: 'sticky', top: 0, zIndex: 1,
      gap: 6, alignItems: 'center',
    }}>
      {cols.map(col => (
        <span
          key={col.key || 'bonded'}
          onClick={col.key ? () => onSort(col.key) : undefined}
          style={{
            cursor: col.key ? 'pointer' : 'default',
            textAlign: col.right ? 'right' : 'left',
            userSelect: 'none',
            color: sortBy === col.key ? '#8B1538' : '#6b7280',
          }}
        >
          {col.label}{col.key ? sortArrow(col.key) : ''}
        </span>
      ))}
      <span></span>
    </div>
  );
}
