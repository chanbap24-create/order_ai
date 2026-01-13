const { loadMasterSheet } = require('./app/lib/masterSheet.ts');

const items = loadMasterSheet();
console.log('Total items loaded:', items.length);
console.log('First 3 items with supply price:');
items.filter(i => i.supplyPrice).slice(0, 3).forEach(item => {
  console.log({
    itemNo: item.itemNo,
    koreanName: item.koreanName,
    englishName: item.englishName,
    supplyPrice: item.supplyPrice
  });
});
