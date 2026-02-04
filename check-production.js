// 프로덕션 API 버전 확인
const productionUrl = 'https://order-ai.vercel.app/api/parse-full-order';

console.log('🔍 Checking production deployment...\n');

fetch(productionUrl)
  .then(res => res.json())
  .then(data => {
    console.log('✅ Production API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.version === '2.0.0') {
      console.log('\n✅ 배포 완료! Version 2.0.0');
      console.log('✅ Suggestions:', data.features?.suggestions);
    } else {
      console.log('\n❌ 구버전 실행 중!');
      console.log('현재 버전:', data.version || '없음');
    }
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    console.log('\n프로덕션 URL을 확인해주세요.');
  });
