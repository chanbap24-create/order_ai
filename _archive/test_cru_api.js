const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testCruSearch() {
  const query = "스시인\n크루 와이너리 산타루치아 몬테레이 3병";
  
  console.log("🔍 테스트 쿼리:", query);
  console.log("\n📡 API 호출 중...\n");
  
  try {
    const response = await fetch('https://order-ai-one.vercel.app/api/parse-full-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query, force_resolve: true })
    });
    
    const data = await response.json();
    
    console.log("✅ API 응답 성공\n");
    console.log("거래처:", data.client_name, `(${data.client_code})`);
    console.log("품목 수:", data.items?.length || 0);
    
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      console.log("\n========== 품목 1 ==========");
      console.log("입력:", item.name);
      console.log("수량:", item.qty);
      console.log("확정 여부:", item.resolved ? "✅ 확정" : "❌ 확인필요");
      
      if (item.resolved) {
        console.log("확정 품목:", item.item_no, "-", item.item_name);
        console.log("점수:", item.score);
      }
      
      console.log("\n후보 품목 (suggestions):");
      if (item.suggestions && item.suggestions.length > 0) {
        item.suggestions.slice(0, 10).forEach((sugg, idx) => {
          const newLabel = sugg.is_new_item ? " [신규]" : "";
          console.log(`${idx + 1}. ${sugg.item_no} - ${sugg.item_name}${newLabel}`);
          console.log(`   점수: ${sugg.score}`);
        });
      } else {
        console.log("❌ 후보가 없습니다!");
      }
      
      // 2421505가 있는지 확인
      const target = item.suggestions?.find(s => s.item_no === '2421505');
      if (target) {
        console.log("\n✅ 정답 품목 2421505 발견!");
        console.log("   이름:", target.item_name);
        console.log("   점수:", target.score);
        console.log("   신규:", target.is_new_item ? "예" : "아니오");
      } else {
        console.log("\n❌ 정답 품목 2421505가 후보에 없습니다!");
        console.log("   → 신규 품목 검색이 작동하지 않는 것으로 보입니다.");
      }
      
      // 2418531이 있는지 확인
      const wrong = item.suggestions?.find(s => s.item_no === '2418531');
      if (wrong) {
        console.log("\n⚠️ 잘못된 품목 2418531 발견!");
        console.log("   이름:", wrong.item_name);
        console.log("   점수:", wrong.score);
      }
    }
  } catch (error) {
    console.error("❌ 오류:", error.message);
  }
}

testCruSearch();
