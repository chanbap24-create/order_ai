import type { Workbook } from "exceljs";
import type { ManagerStat } from "../../types";
import { styleBody, styleHeader } from "./styles";

type Params = {
  mergedData: ManagerStat;
  startYear: string;
  endYear: string;
};

export async function buildShipmentsSheet(wb: Workbook, p: Params) {
  const ws = wb.addWorksheet("출고이력");
  ws.columns = [
    { header: "와인명", key: "wine", width: 36 },
    { header: "날짜", key: "date", width: 12 },
    { header: "거래처", key: "client", width: 28 },
    { header: "공급가", key: "price", width: 12 },
    { header: "수량", key: "qty", width: 8 },
    { header: "담당", key: "manager", width: 10 },
  ];
  styleHeader(ws);

  const codeToName: Record<string, string> = {};
  for (const w of p.mergedData.wine_details || []) {
    for (const c of w.item_code.split(", ")) codeToName[c.trim()] = w.item_name;
  }
  const allCodes = Object.keys(codeToName);
  const rows: {
    wine: string;
    date: string;
    client: string;
    price: number;
    qty: number;
    manager: string;
  }[] = [];
  for (let i = 0; i < allCodes.length; i += 100) {
    const chunk = allCodes.slice(i, i + 100);
    try {
      const res = await fetch("/api/forecast/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCodes: chunk,
          startDate: `${p.startYear}-01-01`,
          endDate: `${p.endYear}-12-31`,
        }),
      });
      const data = await res.json();
      for (const s of data.shipments || []) {
        rows.push({
          wine: codeToName[s.item_no] || s.item_no || "",
          date: s.date,
          client: s.client,
          price: s.price,
          qty: s.qty,
          manager: s.manager,
        });
      }
    } catch {
      /* skip */
    }
  }
  rows.sort((a, b) => a.wine.localeCompare(b.wine) || b.date.localeCompare(a.date));
  for (const r of rows) ws.addRow(r);
  styleBody(ws, [4, 5]);
}
