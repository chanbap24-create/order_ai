import { NextResponse } from "next/server";

/**
 * 매일 오전 9시 자동 실행되는 데이터 동기화 API
 * 
 * Vercel Cron Job으로 실행:
 * - 스케줄: 매일 오전 9시 (KST)
 * - 소요 시간: 약 5분
 * - 월 호출 횟수: 약 30회
 * 
 * 동작:
 * 1. 전산 시스템 API 호출
 * 2. 최신 데이터 조회 (거래처, 품목, 이력)
 * 3. SQLite DB에 저장
 * 4. 로그 기록
 */

export const runtime = "nodejs";
export const maxDuration = 300; // 5분 (Vercel Hobby Plan 최대)

interface CompanyApiConfig {
  baseUrl: string;
  apiKey: string;
}

// 환경변수에서 API 설정 가져오기
function getApiConfig(): CompanyApiConfig | null {
  const baseUrl = process.env.COMPANY_API_URL;
  const apiKey = process.env.COMPANY_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error("[SYNC] API 설정이 없습니다. 환경변수를 확인하세요.");
    console.error("필요한 환경변수: COMPANY_API_URL, COMPANY_API_KEY");
    return null;
  }

  return { baseUrl, apiKey };
}

// 전산 시스템 API 호출
async function fetchFromCompanyApi(
  endpoint: string,
  config: CompanyApiConfig
): Promise<any> {
  const url = `${config.baseUrl}${endpoint}`;
  
  console.log(`[SYNC] API 호출: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000), // 30초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[SYNC] 성공: ${Object.keys(data).length || 0}개 항목`);
    return data;
  } catch (error) {
    console.error(`[SYNC] 실패: ${error}`);
    throw error;
  }
}

// DB에 데이터 저장
async function saveToDatabase(data: {
  clients?: any[];
  items?: any[];
  transactions?: any[];
}): Promise<void> {
  const db = await import("@/app/lib/db").then((m) => m.default);

  // 거래처 정보 저장
  if (data.clients && Array.isArray(data.clients)) {
    console.log(`[SYNC] 거래처 ${data.clients.length}개 저장 중...`);
    
    // 기존 데이터 백업 (선택적)
    // db.exec("CREATE TABLE IF NOT EXISTS clients_backup AS SELECT * FROM clients");
    
    // 데이터 업데이트 (upsert)
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO clients (client_code, client_name, phone, address, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    
    for (const client of data.clients) {
      stmt.run(
        client.client_code,
        client.client_name,
        client.phone || "",
        client.address || ""
      );
    }
  }

  // 품목 정보 저장
  if (data.items && Array.isArray(data.items)) {
    console.log(`[SYNC] 품목 ${data.items.length}개 저장 중...`);
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO items (item_no, item_name, supply_price, category, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    
    for (const item of data.items) {
      stmt.run(
        item.item_no,
        item.item_name,
        item.supply_price || 0,
        item.category || "wine"
      );
    }
  }

  // 거래 이력 저장
  if (data.transactions && Array.isArray(data.transactions)) {
    console.log(`[SYNC] 거래 이력 ${data.transactions.length}개 저장 중...`);
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transactions (
        transaction_id, client_code, item_no, quantity, unit_price, transaction_date
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    for (const tx of data.transactions) {
      stmt.run(
        tx.transaction_id,
        tx.client_code,
        tx.item_no,
        tx.quantity,
        tx.unit_price,
        tx.date
      );
    }
  }

  console.log("[SYNC] DB 저장 완료");
}

// 동기화 로그 기록
function logSync(status: "success" | "failed", details: any): void {
  const log = {
    timestamp: new Date().toISOString(),
    status,
    details,
  };
  
  console.log(`[SYNC LOG] ${JSON.stringify(log)}`);
  
  // 파일 로그 (선택적)
  // fs.appendFileSync("sync.log", JSON.stringify(log) + "\n");
}

export async function GET(req: Request) {
  const startTime = Date.now();
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[SYNC] 일일 데이터 동기화 시작");
  console.log(`[SYNC] 시작 시간: ${new Date().toLocaleString("ko-KR")}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // 1. 환경변수 확인
    const config = getApiConfig();
    
    if (!config) {
      // API 설정이 없으면 기존 엑셀 동기화 사용
      console.log("[SYNC] API 미설정: 엑셀 동기화 사용");
      const { syncFromXlsxIfNeeded } = await import("@/app/lib/syncFromXlsx");
      const result = syncFromXlsxIfNeeded();
      
      logSync("success", { method: "excel", ...result });
      
      return NextResponse.json({
        success: true,
        method: "excel",
        message: "엑셀 파일에서 동기화 완료",
        result,
        duration: Date.now() - startTime,
      });
    }

    // 2. API에서 데이터 가져오기
    console.log("[SYNC] 전산 시스템 API 호출 중...");
    
    const [clients, items, transactions] = await Promise.all([
      fetchFromCompanyApi("/api/clients", config).catch(() => []),
      fetchFromCompanyApi("/api/items", config).catch(() => []),
      fetchFromCompanyApi("/api/transactions?from=6m", config).catch(() => []),
    ]);

    // 3. DB에 저장
    console.log("[SYNC] 데이터베이스 저장 중...");
    await saveToDatabase({
      clients,
      items,
      transactions,
    });

    // 4. 완료
    const duration = Date.now() - startTime;
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[SYNC] 동기화 완료! (${duration}ms)`);
    console.log(`[SYNC] 거래처: ${clients?.length || 0}개`);
    console.log(`[SYNC] 품목: ${items?.length || 0}개`);
    console.log(`[SYNC] 거래 이력: ${transactions?.length || 0}개`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    logSync("success", {
      method: "api",
      clients: clients?.length || 0,
      items: items?.length || 0,
      transactions: transactions?.length || 0,
      duration,
    });

    return NextResponse.json({
      success: true,
      method: "api",
      message: "전산 시스템 API 동기화 완료",
      stats: {
        clients: clients?.length || 0,
        items: items?.length || 0,
        transactions: transactions?.length || 0,
      },
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("[SYNC] 동기화 실패!");
    console.error("[SYNC] 오류:", error.message);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    logSync("failed", {
      error: error.message,
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
