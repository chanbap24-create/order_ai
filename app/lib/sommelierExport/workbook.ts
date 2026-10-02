// 소믈리에 내보내기 엑셀 — 시트: 구매 기록(품목 단위) · 문답 이력 · 손님 취향 요약 · 컬럼 설명.
// 모든 시트에 고객ID/세션ID/판매ID를 넣어 시트 간·추후 추천 프로그램에서 조인할 수 있게 한다.
import ExcelJS from 'exceljs';
import { STORES } from '../store/types';
import type { CustomerRow, CustomerTaste, OrderRow, SessionRow } from './data';

const kst = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ') : '');
const storeLabel = (k: string | null) => STORES.find((s) => s.key === k)?.label || k || '';
const maskPhone = (p: string) => p.replace(/^(\d{3})\d{3,4}(\d{4})$/, '$1-****-$2');
const SOURCE: Record<string, string> = { quiz: '맞춤 추천', stock: '재고 선택' };

type Col = { header: string; key: string; width?: number; num?: string };

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 12, style: c.num ? { numFmt: c.num } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F3F3' } };
  ws.addRows(rows);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
}

export async function buildSommelierWorkbook(d: {
  orders: OrderRow[]; sessions: SessionRow[]; customers: CustomerRow[]; tastes: CustomerTaste[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const cust = new Map(d.customers.map((c) => [c.id, c]));
  const won = '#,##0';

  // ① 구매 기록 — 품목 한 줄 = 한 와인 구매
  sheet(wb, '구매 기록', [
    { header: '판매일시', key: 'at', width: 17 }, { header: '판매ID', key: 'sale', width: 12 },
    { header: '매장', key: 'store', width: 18 }, { header: '법인', key: 'corp', width: 6 }, { header: '담당', key: 'mgr', width: 8 },
    { header: '고객ID', key: 'cid', width: 8 }, { header: '고객명', key: 'cname', width: 9 },
    { header: '경로', key: 'src', width: 10 }, { header: '추천 와인', key: 'rec', width: 9 }, { header: '추천 순위', key: 'rank', width: 9 },
    { header: '문답 세션ID', key: 'sid', width: 11 },
    { header: '품번', key: 'no', width: 10 }, { header: '와인명', key: 'name', width: 34 }, { header: '빈티지', key: 'vin', width: 7 },
    { header: '타입', key: 'type', width: 10 }, { header: '국가', key: 'country', width: 9 }, { header: '지역', key: 'region', width: 24 },
    { header: '품종', key: 'grapes', width: 24 }, { header: '브랜드', key: 'brand', width: 7 }, { header: '생산자', key: 'producer', width: 22 },
    { header: '정상가', key: 'list', num: won }, { header: '백화점가', key: 'dept', num: won }, { header: '최종 단가', key: 'unit', num: won },
    { header: '총 할인율(%)', key: 'dc', width: 11 }, { header: '수량', key: 'qty', width: 6 }, { header: '금액', key: 'amt', num: won },
    { header: '추가할인(%)', key: 'xr', width: 10 }, { header: '추가할인(원)', key: 'xw', num: won },
    { header: '무게감', key: 'body', width: 7 }, { header: '당도', key: 'sweet', width: 6 }, { header: '산미', key: 'acid', width: 6 },
    { header: '탄닌', key: 'tannin', width: 6 }, { header: '향 태그', key: 'flavors', width: 40 },
  ], d.orders.map((o) => ({
    at: kst(o.created_at), sale: o.sale_id ? String(o.sale_id).slice(0, 8) : '', store: storeLabel(o.store_key),
    corp: o.corp ? String(o.corp).toUpperCase() : '', mgr: o.manager, cid: o.customer_id, cname: cust.get(o.customer_id)?.name || '',
    src: SOURCE[o.source] || '', rec: o.recommended == null ? '' : o.recommended ? 'Y' : 'N', rank: o.rec_rank ?? '', sid: o.session_id ?? '',
    no: o.item_code, name: o.item_name, vin: o.vintage || '', type: o.wine_type || '', country: o.country || '', region: o.region || '',
    grapes: o.grapes || '', brand: o.brand || '', producer: o.producer || '',
    list: o.list_price ?? '', dept: o.dept_price ?? '', unit: o.unit_price ?? o.retail_price ?? '',
    dc: o.discount_rate ?? '', qty: o.quantity, amt: o.amount ?? (Number(o.retail_price) || 0) * (Number(o.quantity) || 0),
    xr: o.extra_discount_rate ?? '', xw: o.extra_discount_won ?? '',
    body: o.body ?? '', sweet: o.sweetness ?? '', acid: o.acidity ?? '', tannin: o.tannin ?? '', flavors: (o.flavor_tags || []).join(', '),
  })));

  // ② 문답 이력 — 세션 한 줄. 답변 + 추천 상위 + 실제 구매로 이어진 와인
  const boughtBySession = new Map<number, string[]>();
  for (const o of d.orders) if (o.session_id) boughtBySession.set(o.session_id, [...(boughtBySession.get(o.session_id) || []), o.item_code]);
  sheet(wb, '문답 이력', [
    { header: '일시', key: 'at', width: 17 }, { header: '세션ID', key: 'sid', width: 8 }, { header: '담당', key: 'mgr', width: 8 },
    { header: '고객ID', key: 'cid', width: 8 }, { header: '고객명', key: 'cname', width: 9 },
    { header: '타입', key: 'type', width: 10 }, { header: '바디', key: 'body', width: 8 },
    { header: '가격 최소', key: 'pmin', num: won }, { header: '가격 최대', key: 'pmax', num: won },
    { header: '국가', key: 'countries', width: 24 }, { header: '향 그룹', key: 'groups', width: 28 }, { header: '세부 향', key: 'flavors', width: 24 },
    { header: '추천 수', key: 'n', width: 7 }, { header: '추천 품번(순위순)', key: 'recs', width: 50 }, { header: '구매 품번', key: 'bought', width: 24 },
    { header: '답변 원본(JSON)', key: 'raw', width: 40 },
  ], d.sessions.map((s) => {
    const a = s.answers || {};
    const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v ?? '');
    return {
      at: kst(s.created_at), sid: s.id, mgr: s.manager, cid: s.customer_id, cname: cust.get(s.customer_id)?.name || '',
      type: a.type || '', body: a.body || '', pmin: a.priceMin ?? '', pmax: a.priceMax ?? '',
      countries: list(a.countries), groups: list(a.flavorGroups), flavors: list(a.flavors),
      n: (s.results || []).length, recs: (s.results || []).map((r: { item_code?: string }) => r?.item_code).filter(Boolean).join(', '),
      bought: (boughtBySession.get(s.id) || []).join(', '), raw: JSON.stringify(a),
    };
  }));

  // ③ 손님 취향 요약 — 전체 이력 기준(기간 무관). 추후 추천의 손님 프로필 뼈대
  sheet(wb, '손님 취향 요약', [
    { header: '고객ID', key: 'cid', width: 8 }, { header: '고객명', key: 'cname', width: 9 }, { header: '연락처', key: 'phone', width: 14 },
    { header: '등록 담당', key: 'by', width: 9 }, { header: '마케팅 동의', key: 'mkt', width: 10 },
    { header: '문답 수', key: 'sess', width: 7 }, { header: '첫 방문', key: 'first', width: 17 }, { header: '최근 방문', key: 'last', width: 17 },
    { header: '판매 횟수', key: 'sales', width: 8 }, { header: '총 병수', key: 'bottles', width: 7 }, { header: '총 금액', key: 'amount', num: won },
    { header: '평균 병 단가', key: 'avg', num: won }, { header: '최근 구매', key: 'lastBuy', width: 17 },
    { header: '선호 타입(구매)', key: 'type', width: 12 }, { header: '선호 국가(구매)', key: 'countries', width: 16 },
    { header: '선호 품종(구매)', key: 'grapes', width: 28 }, { header: '자주 산 향', key: 'flavors', width: 36 },
    { header: '평균 무게감', key: 'b', width: 9 }, { header: '평균 당도', key: 's', width: 8 }, { header: '평균 산미', key: 'ac', width: 8 },
    { header: '평균 탄닌', key: 't', width: 8 },
    { header: '문답 선호 타입', key: 'qt', width: 12 }, { header: '문답 선호 바디', key: 'qb', width: 12 }, { header: '문답 선호 가격대', key: 'qp', width: 14 },
    { header: '추천 구매 비율(%)', key: 'rec', width: 14 },
  ], d.tastes.map((t) => ({
    cid: t.customer.id, cname: t.customer.name, phone: maskPhone(String(t.customer.phone || '')), by: t.customer.created_by || '',
    mkt: t.customer.marketing_opt_in ? 'Y' : 'N', sess: t.sessions, first: kst(t.firstVisit), last: kst(t.lastVisit),
    sales: t.sales, bottles: t.bottles, amount: t.amount, avg: t.avgUnit, lastBuy: kst(t.lastPurchase),
    type: t.topType, countries: t.topCountries, grapes: t.topGrapes, flavors: t.topFlavors,
    b: t.avgBody ?? '', s: t.avgSweet ?? '', ac: t.avgAcid ?? '', t: t.avgTannin ?? '',
    qt: t.quizType, qb: t.quizBody, qp: t.quizPrice, rec: t.recShare ?? '',
  })));

  // ④ 컬럼 설명
  sheet(wb, '설명', [{ header: '항목', key: 'k', width: 22 }, { header: '설명', key: 'v', width: 90 }], [
    { k: '판매ID', v: "정산 '판매 완료' 1회 단위. 같은 판매ID = 함께 결제한 와인들" },
    { k: '경로', v: '맞춤 추천 = 취향 문답 추천 결과에서 담음 / 재고 선택 = 재고 검색에서 직접 담음' },
    { k: '추천 와인 · 추천 순위', v: '그 손님의 직전 문답 추천 결과에 있던 와인인지와 그 순위' },
    { k: '정상가 → 백화점가 → 최종 단가', v: '백화점 할인 밴드 적용 → 추가 할인(%·원)을 품목에 비례 배분한 실제 결제 단가' },
    { k: '무게감·당도·산미·탄닌', v: '테이스팅 노트 1(라이트·드라이·낮음)~5(풀바디·스위트·높음). 구매 시점 값' },
    { k: '와인 속성', v: '타입·국가·지역·품종·브랜드·생산자 — 구매 시점 스냅샷(이후 와인 정보가 바뀌어도 유지)' },
    { k: '손님 취향 요약', v: '기간 선택과 무관하게 전체 이력 기준. 구매는 병수 가중' },
    { k: '이전 기록', v: '2026-10-02 이전 구매는 매장·경로·할인 내역이 비어 있을 수 있음(와인 속성은 보강됨)' },
    { k: '개인정보', v: '연락처는 마스킹. 고객ID로 시트 간 연결. 보유기간(마지막 방문 3년) 경과 시 자동 파기' },
  ]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
