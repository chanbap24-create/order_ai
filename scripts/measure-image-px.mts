// dept 풀 와인 이미지의 최대 변(px)을 측정해 wines.image_px에 저장 — 인트로 고해상 필터용
import { supabase } from '../app/lib/db';
const { data: dept } = await supabase.from('dept_store_stock').select('item_no');
const codes = (dept||[]).map(d=>d.item_no).filter(c=>/^([0-5A]|ZK)/i.test(c));
const wines: {code:string;url:string}[] = [];
for (let i=0;i<codes.length;i+=500){
  const { data: ws } = await supabase.from('wines').select('item_code,image_url').in('item_code', codes.slice(i,i+500)).not('image_url','is',null);
  for (const w of ws||[]) if (/^https?:/.test(w.image_url||'')) wines.push({code:w.item_code,url:w.image_url!});
}
function dims(b:Buffer):[number,number]|null{
  if(b[0]===0x89&&b[1]===0x50) return [b.readUInt32BE(16),b.readUInt32BE(20)];
  if(b[0]===0xff&&b[1]===0xd8){let i=2;while(i<b.length-8){if(b[i]!==0xff){i++;continue;}const m=b[i+1];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC){return [b.readUInt16BE(i+7),b.readUInt16BE(i+5)];}i+=2+b.readUInt16BE(i+2);}}
  return null;
}
let done=0, ok=0;
const queue=[...wines];
await Promise.all(Array.from({length:12},async()=>{
  while(queue.length){
    const w=queue.shift()!;
    try{
      const ac=new AbortController();const t=setTimeout(()=>ac.abort(),10000);
      const r=await fetch(w.url,{signal:ac.signal,headers:{'User-Agent':'Mozilla/5.0'}});
      clearTimeout(t);
      const d=dims(Buffer.from(await r.arrayBuffer()));
      if(d){ await supabase.from('wines').update({image_px: Math.max(d[0],d[1])}).eq('item_code',w.code); ok++; }
    }catch{/* skip */}
    if(++done%100===0) console.error(done+'/'+wines.length);
  }
}));
console.log('측정·저장:', ok, '/', wines.length);
