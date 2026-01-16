const fetch = require('node-fetch');

async function test() {
  const payload = {
    message: "배산임수\n클레멍 라발리 샤블리 2",
    force_resolve: true
  };
  
  console.log("=== API 호출 ===");
  console.log("Payload:", JSON.stringify(payload, null, 2));
  
  const res = await fetch("https://order-ai-one.vercel.app/api/parse-full-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  
  const json = await res.json();
  
  console.log("\n=== 응답 ===");
  console.log("Status:", res.status);
  console.log("\n거래처:", json.client?.client_name, `(${json.client?.client_code})`);
  console.log("\n품목 결과:");
  
  if (json.parsed_items) {
    json.parsed_items.forEach((item, i) => {
      console.log(`\n[${i+1}] ${item.name} (${item.quantity})`);
      console.log(`  - resolved: ${item.resolved}`);
      console.log(`  - method: ${item.method}`);
      
      if (item.resolved) {
        console.log(`  ✅ 확정: ${item.item_no} - ${item.item_name}`);
      } else if (item.suggestions && item.suggestions.length > 0) {
        console.log(`  ❌ 후보:`);
        item.suggestions.forEach((s, j) => {
          console.log(`     ${j+1}) ${s.item_no} - ${s.item_name} (${s.score?.toFixed(3)}) ${s.is_new_item ? '신규' : '확인'}`);
        });
      }
    });
  }
}

test().catch(console.error);
