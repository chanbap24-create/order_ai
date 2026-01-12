import Database from 'better-sqlite3';

const db = new Database('./data.sqlite3');

const clients = db.prepare('SELECT client_code, client_name FROM clients LIMIT 10').all();
console.log('Available clients:');
clients.forEach(c => {
  console.log(`  ${c.client_code} - ${c.client_name}`);
});

// Get one with items
const clientWithItems = db.prepare(`
  SELECT DISTINCT c.client_code, c.client_name, COUNT(cis.item_no) as item_count
  FROM clients c
  INNER JOIN client_item_stats cis ON c.client_code = cis.client_code
  GROUP BY c.client_code
  LIMIT 3
`).all();

console.log('\nClients with items:');
clientWithItems.forEach(c => {
  console.log(`  ${c.client_code} - ${c.client_name} (${c.item_count} items)`);
});

db.close();
