const apiKey = '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';

console.log('🧪 Testing with native fetch API...\n');

async function testWithFetch() {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "Hello from Order AI!"' }],
        max_tokens: 20
      })
    });

    console.log('Status:', response.status);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS with fetch!');
      console.log('Response:', data.choices[0].message.content);
      console.log('Tokens:', data.usage.total_tokens);
    } else {
      console.log('❌ Error:', data.error);
    }
  } catch (error) {
    console.error('❌ Fetch failed:', error.message);
  }
}

testWithFetch();
