async function test() {
  try {
    const response = await fetch('http://localhost:3020/api/interpret-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_order_text: "샤르도네 2병",
        client_code: "31833"
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}
test();
