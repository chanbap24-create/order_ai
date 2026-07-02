// 거래처 업장 유형 태그 조회/저장. client_venue (client_code, client_type) upsert.
import { supabase } from '@/app/lib/db';
import { isValidVenue } from '@/app/lib/venueTypes';

export type VenueClientType = 'wine' | 'glass';

export async function getClientVenue(clientCode: string, clientType: VenueClientType): Promise<string | null> {
  const { data } = await supabase
    .from('client_venue')
    .select('venue')
    .eq('client_code', clientCode)
    .eq('client_type', clientType)
    .maybeSingle();
  return data?.venue ?? null;
}

/** venue='' 이면 태그 해제(행 삭제). 유효한 key면 upsert. */
export async function setClientVenue(clientCode: string, clientType: VenueClientType, venue: string): Promise<void> {
  if (!venue) {
    await supabase.from('client_venue').delete().eq('client_code', clientCode).eq('client_type', clientType);
    return;
  }
  if (!isValidVenue(venue)) throw new Error('유효하지 않은 업장 유형입니다.');
  await supabase
    .from('client_venue')
    .upsert({ client_code: clientCode, client_type: clientType, venue, updated_at: new Date().toISOString() },
      { onConflict: 'client_code,client_type' });
}
