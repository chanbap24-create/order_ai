const OpenAI = require('openai').default;

const apiKey = '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';

console.log('🔑 Testing NEW OpenAI API Key...');
console.log('Key preview:', apiKey.substring(0, 20) + '...' + apiKey.substring(apiKey.length - 10));

const openai = new OpenAI({ apiKey });

async function testKey() {
  try {
    console.log('\n📡 Sending test request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello from Order AI!"' }],
      max_tokens: 20
    });
    
    console.log('\n✅ SUCCESS! API Key is VALID!');
    console.log('🤖 GPT Response:', response.choices[0].message.content);
    console.log('📊 Tokens used:', response.usage.total_tokens);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED! API Key test failed!');
    console.error('Error:', error.message);
    if (error.status) console.error('Status:', error.status);
    process.exit(1);
  }
}

testKey();
