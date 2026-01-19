async function testAPI() {
  // 스크린샷처럼 "확인필요" 거래처로 테스트
  const response = await fetch('https://order-ai-one.vercel.app/api/parse-full-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '확인필요\n링트레일스 씨더메인 카베르네쇼뉴',
      force_resolve: false  // 실제 사용자처럼
    })
  });
  
  const data = await response.json();
  console.log('Full response keys:', Object.keys(data));
  console.log('Full response:', JSON.stringify(data, null, 2).substring(0, 2000));
}

testAPI().catch(console.error);
