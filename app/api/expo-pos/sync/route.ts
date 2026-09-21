// 행사 POS 백업 API — 행사 코드(x-expo-key) 검증 후 기기 스냅샷 업서트/목록/복원.
// 미들웨어에서 세션 인증 예외. 로직은 app/lib/expoPos.ts.
import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/app/lib/api-response';
import { checkExpoKey, getSnapshot, listSnapshots, upsertSnapshot } from '@/app/lib/expoPos';

export const runtime = 'nodejs';

function unauthorized() {
  return errorResponse('행사 코드가 올바르지 않습니다', 401);
}

/** GET ?device=<id> → 해당 기기 스냅샷, 없으면 기기 목록 */
export async function GET(req: NextRequest) {
  if (!checkExpoKey(req.headers.get('x-expo-key'))) return unauthorized();
  try {
    const device = req.nextUrl.searchParams.get('device');
    if (device) {
      const snap = await getSnapshot(device);
      return snap ? successResponse(snap) : errorResponse('저장된 기록이 없습니다', 404);
    }
    return successResponse(await listSnapshots());
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : '조회 실패', 500);
  }
}

/** POST { deviceId, deviceName, eventName, state } → 업서트 */
export async function POST(req: NextRequest) {
  if (!checkExpoKey(req.headers.get('x-expo-key'))) return unauthorized();
  try {
    const body = await req.json();
    const deviceId = String(body?.deviceId || '').slice(0, 64);
    if (!deviceId || !body?.state || typeof body.state !== 'object') return errorResponse('deviceId, state 필요', 400);
    const meta = await upsertSnapshot({
      deviceId,
      deviceName: String(body.deviceName || ''),
      eventName: String(body.eventName || ''),
      state: body.state,
    });
    return successResponse(meta);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : '저장 실패', 500);
  }
}
