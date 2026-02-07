import Database from 'better-sqlite3';

const db = new Database('./data.sqlite3');

console.log('=== Database Tables ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(r => r.name).join(', '));

console.log('\n=== Token Mapping Count ===');
try {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM token_mapping').get();
  console.log('Token mappings:', count.cnt);
  
  console.log('\n=== Sample Token Mappings ===');
  const samples = db.prepare('SELECT * FROM token_mapping LIMIT 5').all();
  console.log(samples);
} catch (err) {
  console.error('Error:', err.message);
}

db.close();
