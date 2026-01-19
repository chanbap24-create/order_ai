const query = "스시인\n크루 와이너리 산타루치아 몬테레이 3병";

console.log("테스트 쿼리:", query);
console.log("\n배포 대기 중... (1-2분 소요)");
console.log("Vercel URL: https://order-ai-one.vercel.app/wine");
console.log("\n예상 결과:");
console.log("✅ 1위: 크루 와이너리 피노누아 산타 루치아 하이랜즈 몬테레이 (2421505) - 0.950+");
console.log("❌ 2위: 크루 와이너리 피노누아 몬테레이 (2418531) - 0.800");
console.log("\n테스트 명령:");
console.log(`curl -X POST https://order-ai-one.vercel.app/api/parse-full-order \\
  -H "Content-Type: application/json" \\
  -d '{"message": "${query}", "force_resolve": true}' | jq '.items[0].suggestions[:2] | .[] | {item_no, item_name, score}'`);
