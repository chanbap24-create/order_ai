// app/api/admin/client-analysis/route.ts
// 거래처 분석 API — 집계/필터링 쿼리 (페이지네이션으로 전체 데이터 수집)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/lib/db";
import { handleApiError } from "@/app/lib/errors";

interface ShipmentRow {
  client_name: string;
  client_code: string;
  ship_date: string;
  item_no: string;
  item_name: string;
  quantity: number;
  unit_price: number | null;
  selling_price: number | null;
  total_amount: number | null;
  supply_amount: number | null;
  business_type: string | null;
  manager: string | null;
  department: string | null;
}

const SELECT_COLS = "client_name, client_code, ship_date, item_no, item_name, quantity, unit_price, selling_price, total_amount, supply_amount, business_type, manager, department";
const PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const type = sp.get("type") || "wine";
    const clientCode = sp.get("clientCode") || "";
    const manager = sp.get("manager") || "";
    const department = sp.get("department") || "";
    const businessType = sp.get("businessType") || "";
    const clientSearch = sp.get("clientSearch") || "";
    const startDate = sp.get("startDate") || "";
    const endDate = sp.get("endDate") || "";

    const table = type === "glass" ? "glass_shipments" : "shipments";

    // 거래처 상세 조회 모드
    if (clientCode) {
      const itemMap = new Map<string, {
        item_no: string; item_name: string; quantity: number; revenue: number; count: number;
        normalTotal: number; sellingTotal: number;
      }>();

      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let q = supabase
          .from(table)
          .select("item_no, item_name, quantity, supply_amount, selling_price")
          .eq("client_code", clientCode)
          .range(offset, offset + PAGE_SIZE - 1);
        if (startDate) q = q.gte("ship_date", startDate);
        if (endDate) q = q.lte("ship_date", endDate);

        const { data: rows, error } = await q;
        if (error) throw new Error(error.message);
        if (!rows || rows.length === 0) { hasMore = false; break; }

        for (const r of rows) {
          const key = r.item_no;
          if (!itemMap.has(key)) {
            itemMap.set(key, { item_no: r.item_no, item_name: r.item_name, quantity: 0, revenue: 0, count: 0, normalTotal: 0, sellingTotal: 0 });
          }
          const it = itemMap.get(key)!;
          const qty = r.quantity || 0;
          it.quantity += qty;
          it.revenue += r.supply_amount || 0;
          it.count += 1;
          if (r.selling_price && r.selling_price > 0 && qty > 0) {
            it.sellingTotal += r.selling_price * qty;
          }
        }

        if (rows.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      }

      // 인벤토리 정상공급가 조회
      const invTable = type === "glass" ? "inventory_dl" : "inventory_cdv";
      const detailItemNos = Array.from(itemMap.keys());
      const detailInvMap = new Map<string, number>();
      for (let i = 0; i < detailItemNos.length; i += 300) {
        const batch = detailItemNos.slice(i, i + 300);
        const { data: invRows } = await supabase.from(invTable).select("item_no, supply_price").in("item_no", batch);
        if (invRows) {
          for (const iv of invRows) {
            if (iv.supply_price && iv.supply_price > 0) detailInvMap.set(iv.item_no, iv.supply_price);
          }
        }
      }

      // normalTotal 채우기
      for (const [itemNo, it] of itemMap) {
        const invPrice = detailInvMap.get(itemNo);
        if (invPrice && invPrice > 0 && it.quantity > 0) {
          it.normalTotal = invPrice * it.quantity;
        }
      }

      const clientItems = Array.from(itemMap.values())
        .map(it => {
          const supplyPrice = detailInvMap.get(it.item_no) ?? null;
          const avgSellingPrice = it.quantity > 0 && it.sellingTotal > 0
            ? Math.round(it.sellingTotal / it.quantity)
            : null;
          return {
            item_no: it.item_no, item_name: it.item_name,
            quantity: it.quantity, revenue: it.revenue, count: it.count,
            supplyPrice,
            avgSellingPrice,
            discountRate: it.normalTotal > 0
              ? Math.round(((it.normalTotal - it.sellingTotal) / it.normalTotal) * 1000) / 10
              : null,
          };
        })
        .sort((a, b) => b.revenue - a.revenue);
      return NextResponse.json({ success: true, clientItems });
    }

    // 페이지네이션으로 전체 데이터 수집
    const allData: ShipmentRow[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(table)
        .select(SELECT_COLS)
        .range(offset, offset + PAGE_SIZE - 1);

      if (manager) query = query.eq("manager", manager);
      if (department) query = query.eq("department", department);
      if (businessType) query = query.eq("business_type", businessType);
      if (startDate) query = query.gte("ship_date", startDate);
      if (endDate) query = query.lte("ship_date", endDate);
      if (clientSearch) query = query.ilike("client_name", `%${clientSearch}%`);

      const { data: rows, error } = await query;

      if (error) throw new Error(error.message);

      if (!rows || rows.length === 0) {
        hasMore = false;
      } else {
        allData.push(...(rows as ShipmentRow[]));
        if (rows.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += PAGE_SIZE;
        }
      }
    }

    const data = allData;

    // 총 매출/수량/건수
    let totalRevenue = 0;
    let totalQuantity = 0;
    const totalCount = data.length;

    for (const r of data) {
      totalRevenue += r.supply_amount || 0;
      totalQuantity += r.quantity || 0;
    }

    // 거래처별 매출 순위
    const clientMap = new Map<string, { code: string; name: string; revenue: number; quantity: number; items: Set<string> }>();
    for (const r of data) {
      const key = r.client_code;
      if (!clientMap.has(key)) {
        clientMap.set(key, { code: key, name: r.client_name, revenue: 0, quantity: 0, items: new Set() });
      }
      const c = clientMap.get(key)!;
      c.revenue += r.supply_amount || 0;
      c.quantity += r.quantity || 0;
      if (r.item_no) c.items.add(r.item_no);
    }

    const clientRankingSorted = Array.from(clientMap.values())
      .map(c => ({ code: c.code, name: c.name, revenue: c.revenue, quantity: c.quantity, itemCount: c.items.size }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 30);

    // 이전 동일 기간 랭킹 계산 (순위 변동 표시용)
    let prevRankMap = new Map<string, number>(); // code → rank (1-based)
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - days);
      const prevStartStr = prevStart.toISOString().slice(0, 10);
      const prevEndStr = prevEnd.toISOString().slice(0, 10);

      const prevClientMap = new Map<string, number>();
      let pOffset = 0;
      let pHasMore = true;
      while (pHasMore) {
        let pq = supabase
          .from(table)
          .select("client_code, supply_amount")
          .gte("ship_date", prevStartStr)
          .lte("ship_date", prevEndStr)
          .range(pOffset, pOffset + PAGE_SIZE - 1);
        if (manager) pq = pq.eq("manager", manager);
        if (department) pq = pq.eq("department", department);
        if (businessType) pq = pq.eq("business_type", businessType);
        if (clientSearch) pq = pq.ilike("client_name", `%${clientSearch}%`);

        const { data: pRows, error: pErr } = await pq;
        if (pErr || !pRows || pRows.length === 0) { pHasMore = false; break; }
        for (const r of pRows) {
          prevClientMap.set(r.client_code, (prevClientMap.get(r.client_code) || 0) + (r.supply_amount || 0));
        }
        if (pRows.length < PAGE_SIZE) pHasMore = false;
        else pOffset += PAGE_SIZE;
      }

      const prevSorted = Array.from(prevClientMap.entries())
        .sort((a, b) => b[1] - a[1]);
      prevSorted.forEach(([code], i) => { prevRankMap.set(code, i + 1); });
    }

    // 인벤토리 정상공급가 조회 (할인율 계산용)
    const invTable = type === "glass" ? "inventory_dl" : "inventory_cdv";
    const allItemNos = new Set<string>();
    for (const r of data) { if (r.item_no) allItemNos.add(r.item_no); }
    const invPriceMap = new Map<string, number>(); // item_no → supply_price
    const invCountryMap = new Map<string, string>(); // item_no → country
    const itemNoArr = Array.from(allItemNos);
    // Supabase in() 최대 약 300개씩 배치
    for (let i = 0; i < itemNoArr.length; i += 300) {
      const batch = itemNoArr.slice(i, i + 300);
      const { data: invRows } = await supabase
        .from(invTable)
        .select("item_no, supply_price, country")
        .in("item_no", batch);
      if (invRows) {
        for (const iv of invRows) {
          if (iv.supply_price && iv.supply_price > 0) {
            invPriceMap.set(iv.item_no, iv.supply_price);
          }
          if (iv.country) {
            invCountryMap.set(iv.item_no, iv.country);
          }
        }
      }
    }

    // 거래처별 할인율 계산: (정상공급가 - 판매단가) / 정상공급가 × 100 (수량 가중)
    const clientDiscountMap = new Map<string, { normalTotal: number; sellingTotal: number }>();
    for (const r of data) {
      const invPrice = invPriceMap.get(r.item_no);
      const sellPrice = r.selling_price;
      const qty = r.quantity || 0;
      if (invPrice && invPrice > 0 && sellPrice != null && sellPrice > 0 && qty > 0) {
        if (!clientDiscountMap.has(r.client_code)) {
          clientDiscountMap.set(r.client_code, { normalTotal: 0, sellingTotal: 0 });
        }
        const d = clientDiscountMap.get(r.client_code)!;
        d.normalTotal += invPrice * qty;
        d.sellingTotal += sellPrice * qty;
      }
    }

    const clientRanking = clientRankingSorted.map((c, i) => {
      const currentRank = i + 1;
      const prevRank = prevRankMap.get(c.code);
      const disc = clientDiscountMap.get(c.code);
      const discountRate = disc && disc.normalTotal > 0
        ? Math.round(((disc.normalTotal - disc.sellingTotal) / disc.normalTotal) * 1000) / 10
        : null;
      return {
        ...c,
        rankChange: prevRank != null ? prevRank - currentRank : null,
        isNew: prevRankMap.size > 0 && prevRank == null,
        discountRate,
      };
    });

    // 브랜드 약어 추출
    // wine: 영문 2~4자 (BS, CH, BL 등)
    // glass: "RD 4100/16R ..." → "4100" (RD 뒤 숫자가 브랜드)
    function extractBrand(itemName: string): string {
      const tokens = (itemName || '').split(/[\s]+/);
      if (type === 'glass') {
        // "RD 4100/16R ..." → 두 번째 토큰에서 숫자 부분 추출
        if (tokens.length >= 2 && /^RD$/i.test(tokens[0])) {
          const match = tokens[1].match(/^(\d{3,5})/);
          if (match) return match[1];
        }
        return '';
      }
      const first = tokens[0].toUpperCase();
      if (/^[A-Z]{2,4}$/.test(first)) return first;
      return '';
    }

    // 업종명 정리: "off/백화점" → "백화점", "etc/기타" → "기타"
    function cleanBizType(biz: string): string {
      if (!biz) return '미분류';
      const slashIdx = biz.indexOf('/');
      return slashIdx >= 0 ? biz.slice(slashIdx + 1) : biz;
    }

    // 담당자별 분석 (브랜드별 매출 + 업종별 거래처수 + 할인율)
    const mgrMap = new Map<string, {
      manager: string; clients: Set<string>; revenue: number;
      brands: Map<string, number>;
      bizClients: Map<string, Set<string>>;
      normalTotal: number; sellingTotal: number;
    }>();
    for (const r of data) {
      const m = r.manager || '(미지정)';
      if (!mgrMap.has(m)) mgrMap.set(m, { manager: m, clients: new Set(), revenue: 0, brands: new Map(), bizClients: new Map(), normalTotal: 0, sellingTotal: 0 });
      const mg = mgrMap.get(m)!;
      mg.clients.add(r.client_code);
      const amt = r.supply_amount || 0;
      mg.revenue += amt;
      const brand = extractBrand(r.item_name);
      if (brand) {
        mg.brands.set(brand, (mg.brands.get(brand) || 0) + amt);
      }
      const biz = cleanBizType(r.business_type || '(미분류)');
      if (!mg.bizClients.has(biz)) mg.bizClients.set(biz, new Set());
      mg.bizClients.get(biz)!.add(r.client_code);
      // 할인율 계산용
      const invPrice = invPriceMap.get(r.item_no);
      const sellPrice = r.selling_price;
      const qty = r.quantity || 0;
      if (invPrice && invPrice > 0 && sellPrice != null && sellPrice > 0 && qty > 0) {
        mg.normalTotal += invPrice * qty;
        mg.sellingTotal += sellPrice * qty;
      }
    }

    const managerAnalysis = Array.from(mgrMap.values())
      .map(m => ({
        manager: m.manager,
        clientCount: m.clients.size,
        revenue: m.revenue,
        discountRate: m.normalTotal > 0
          ? Math.round(((m.normalTotal - m.sellingTotal) / m.normalTotal) * 1000) / 10
          : null,
        brands: Array.from(m.brands.entries())
          .map(([brand, revenue]) => ({ brand, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10),
        bizClients: Array.from(m.bizClients.entries())
          .map(([biz, clients]) => ({ biz, count: clients.size }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // 업종별 매출
    const bizMap = new Map<string, number>();
    for (const r of data) {
      const b = cleanBizType(r.business_type || '(미분류)');
      bizMap.set(b, (bizMap.get(b) || 0) + (r.supply_amount || 0));
    }

    const businessAnalysis = Array.from(bizMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // 브랜드별 매출 (전체)
    const brandMap = new Map<string, number>();
    for (const r of data) {
      const brand = extractBrand(r.item_name);
      if (brand) {
        brandMap.set(brand, (brandMap.get(brand) || 0) + (r.supply_amount || 0));
      }
    }
    const brandAnalysis = Array.from(brandMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

    // 일별 매출 추이
    const dailyMap = new Map<string, number>();
    for (const r of data) {
      if (!r.ship_date) continue;
      const d = String(r.ship_date).slice(0, 10);
      dailyMap.set(d, (dailyMap.get(d) || 0) + (r.supply_amount || 0));
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 국가별 매출
    const countryRevMap = new Map<string, number>();
    for (const r of data) {
      const country = invCountryMap.get(r.item_no) || '(미분류)';
      countryRevMap.set(country, (countryRevMap.get(country) || 0) + (r.supply_amount || 0));
    }
    const countryAnalysis = Array.from(countryRevMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

    return NextResponse.json({
      success: true,
      summary: { totalRevenue, totalQuantity, totalCount },
      clientRanking,
      managerAnalysis,
      businessAnalysis,
      brandAnalysis,
      countryAnalysis,
      dailyTrend,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
