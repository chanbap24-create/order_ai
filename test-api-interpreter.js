async function testOrderInterpreter() {
  const url = 'http://localhost:3010/api/interpret-order';
  
  const testOrder = {
    raw_order_text: "메종 로쉐 벨렌 샤르도네 3병",
    client_code: "31833"
  };
  
  console.log('🧪 Testing Order Interpreter API...\n');
  console.log('Request:', JSON.stringify(testOrder, null, 2));
  console.log('\n📡 Sending request...\n');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testOrder)
    });
    
    console.log('Status:', response.status);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ SUCCESS!\n');
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.success && data.data) {
        console.log('\n📊 Summary:');
        console.log('- Items found:', data.data.items?.length || 0);
        console.log('- Needs review:', data.data.needs_review);
        console.log('- Client name:', data.data.client_name || 'N/A');
      }
    } else {
      console.log('\n❌ ERROR!\n');
      console.log('Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n💥 Request failed:', error.message);
  }
}

testOrderInterpreter();
