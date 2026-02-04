const OpenAI = require('openai').default;

const apiKey = process.env.OPENAI_API_KEY || 'eCrEw78U97rcl1bCGxC4T3BlbkFJRgFh4R9s9xXkPjRJQJkk9iM5';

console.log('🔑 Testing OpenAI API Key...');
console.log('Key preview:', apiKey.substring(0, 15) + '...' + apiKey.substring(apiKey.length - 4));

const openai = new OpenAI({ apiKey });

async function testKey() {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello"' }],
      max_tokens: 10
    });
    
    console.log('✅ API Key is VALID!');
    console.log('Response:', response.choices[0].message.content);
    process.exit(0);
  } catch (error) {
    console.error('❌ API Key test FAILED!');
    console.error('Error:', error.message);
    console.error('Status:', error.status);
    process.exit(1);
  }
}

testKey();
