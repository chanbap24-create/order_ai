const apiKey = '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';

console.log('🔍 API Key Analysis:');
console.log('Length:', apiKey.length);
console.log('Starts with:', apiKey.substring(0, 8));
console.log('Format valid:', apiKey.startsWith('sk-proj-'));
console.log('Contains spaces:', apiKey.includes(' '));
console.log('Contains newlines:', apiKey.includes('\n'));

// Try with curl
const { execSync } = require('child_process');

console.log('\n📡 Testing with curl...');
try {
  const result = execSync(`curl https://api.openai.com/v1/models -H "Authorization: Bearer ${apiKey}" -s`, {
    encoding: 'utf-8',
    timeout: 10000
  });
  
  const parsed = JSON.parse(result);
  if (parsed.data) {
    console.log('✅ API Key works with curl!');
    console.log('Available models:', parsed.data.length);
  } else if (parsed.error) {
    console.log('❌ Error:', parsed.error.message);
  }
} catch (error) {
  console.log('❌ Curl test failed:', error.message);
}
