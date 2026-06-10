// 테이스팅노트 목록 제외 플래그 (wines.note_excluded)
import { supabase } from "@/app/lib/db";

export async function setNoteExcluded(itemCode: string, excluded: boolean): Promise<void> {
  const { error } = await supabase
    .from("wines")
    .update({ note_excluded: excluded })
    .eq("item_code", itemCode);
  if (error) throw new Error(`note_excluded 업데이트 실패: ${error.message}`);
}
