import { loadAllMasterItems } from './app/lib/masterSheet.ts';

const items = loadAllMasterItems();
console.log('Total items:', items.length);

// Find 3022042
const found = items.find(i => i.itemNo === '3022042');
if (found) {
  console.log();
  console.log('✅ Found 3022042:');
  console.log('  itemNo:', found.itemNo);
  console.log('  koreanName:', found.koreanName);
  console.log('  englishName:', found.englishName);
  console.log('  vintage:', found.vintage);
  console.log('  supplyPrice:', found.supplyPrice);
} else {
  console.log();
  console.log('❌ 3022042 NOT FOUND in loadAllMasterItems()');
  
  // Search for items with Montee
  console.log();
  console.log('Searching for items with "Montee" in English name...');
  const montee = items.filter(i => i.englishName && i.englishName.toLowerCase().includes('montee'));
  console.log(`Found ${montee.length} items:`);
  montee.forEach(m => {
    console.log(`  - ${m.itemNo}: ${m.englishName}`);
  });
}
